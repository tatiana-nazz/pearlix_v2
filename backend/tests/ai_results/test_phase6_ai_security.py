from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta
from importlib import import_module
from io import BytesIO
from threading import Barrier

import pytest
from django.apps import apps as django_apps
from django.db import close_old_connections, connection
from django.utils import timezone
from PIL import Image

from apps.accounts.models import User
from apps.ai_results import services
from apps.ai_results.models import AIExecutionState, AIInvocationBucket, AIResult
from apps.ai_results.result_types import PipelineResult
from apps.ai_results.services import (
    AICapacityBusy,
    AIRateLimited,
    AIStorageQuotaExceeded,
    _claim_processing,
    run_ai_for_xray,
)
from apps.xrays.models import XrayAttachment
from apps.xrays.quota import StorageQuotaExceeded, enforce_storage_quota


@pytest.fixture(autouse=True)
def phase6_ai_limits(settings, tmp_path):
    settings.MEDIA_ROOT = tmp_path
    settings.PEARLIX_AI_MAX_ACTIVE_JOBS_GLOBAL = 10
    settings.PEARLIX_AI_MAX_ACTIVE_JOBS_PER_USER = 1
    settings.PEARLIX_AI_INVOCATION_WINDOW_SECONDS = 3600
    settings.PEARLIX_AI_MAX_INVOCATIONS_PER_USER = 20
    settings.PEARLIX_AI_MAX_INVOCATIONS_GLOBAL = 100
    settings.PEARLIX_XRAY_PATIENT_QUOTA_BYTES = 10_000_000
    settings.PEARLIX_XRAY_USER_QUOTA_BYTES = 10_000_000
    settings.PEARLIX_XRAY_GLOBAL_QUOTA_BYTES = 10_000_000


def _complete_claim(claim):
    AIResult.objects.filter(pk=claim.result_id).update(
        status=AIResult.Status.COMPLETED,
        model_version="phase6-complete",
    )


def _overlay_png(size=(12, 8)) -> bytes:
    output = BytesIO()
    Image.new("RGB", size, (80, 80, 80)).save(output, format="PNG")
    return output.getvalue()


@pytest.mark.django_db
def test_ai_per_user_admission_uses_requester_not_source_uploader(
    settings,
    xray_attachment_factory,
    doctor_user,
    other_doctor_user,
):
    settings.PEARLIX_AI_MAX_ACTIVE_JOBS_GLOBAL = 2
    own_source = xray_attachment_factory(uploaded_by=doctor_user)
    other_owned_source = xray_attachment_factory(uploaded_by=other_doctor_user)
    other_request_source = xray_attachment_factory(uploaded_by=doctor_user)

    first_claim, _ = _claim_processing(
        source_model=XrayAttachment,
        source_id=own_source.id,
        source_field="xray_attachment",
        user=doctor_user,
    )
    with pytest.raises(AICapacityBusy):
        _claim_processing(
            source_model=XrayAttachment,
            source_id=other_owned_source.id,
            source_field="xray_attachment",
            user=doctor_user,
        )
    second_claim, _ = _claim_processing(
        source_model=XrayAttachment,
        source_id=other_request_source.id,
        source_field="xray_attachment",
        user=other_doctor_user,
    )

    assert AIResult.objects.get(pk=first_claim.result_id).requested_by == doctor_user
    assert AIResult.objects.get(pk=second_claim.result_id).requested_by == other_doctor_user
    assert not AIResult.objects.filter(xray_attachment=other_owned_source).exists()


@pytest.mark.django_db
def test_user_budget_counts_completed_jobs_and_rejects_without_processing_row(
    settings,
    xray_attachment_factory,
    doctor_user,
):
    settings.PEARLIX_AI_MAX_INVOCATIONS_PER_USER = 2
    sources = [xray_attachment_factory(uploaded_by=doctor_user) for _ in range(3)]
    for source in sources[:2]:
        claim, _ = _claim_processing(
            source_model=XrayAttachment,
            source_id=source.id,
            source_field="xray_attachment",
            user=doctor_user,
        )
        _complete_claim(claim)

    with pytest.raises(AIRateLimited):
        _claim_processing(
            source_model=XrayAttachment,
            source_id=sources[2].id,
            source_field="xray_attachment",
            user=doctor_user,
        )

    bucket = AIInvocationBucket.objects.get(scope=AIInvocationBucket.Scope.USER, key=str(doctor_user.id))
    assert bucket.request_count == 2
    assert not AIResult.objects.filter(xray_attachment=sources[2]).exists()


@pytest.mark.django_db
def test_invocation_budget_expires_and_is_independent_between_users(
    monkeypatch,
    settings,
    xray_attachment_factory,
    doctor_user,
    other_doctor_user,
):
    settings.PEARLIX_AI_MAX_INVOCATIONS_PER_USER = 1
    current = [timezone.now()]
    monkeypatch.setattr(services.timezone, "now", lambda: current[0])
    first = xray_attachment_factory(uploaded_by=doctor_user)
    claim, _ = _claim_processing(
        source_model=XrayAttachment,
        source_id=first.id,
        source_field="xray_attachment",
        user=doctor_user,
    )
    _complete_claim(claim)

    other_source = xray_attachment_factory(uploaded_by=other_doctor_user)
    other_claim, _ = _claim_processing(
        source_model=XrayAttachment,
        source_id=other_source.id,
        source_field="xray_attachment",
        user=other_doctor_user,
    )
    _complete_claim(other_claim)

    current[0] += timedelta(seconds=3601)
    after_expiry = xray_attachment_factory(uploaded_by=doctor_user)
    renewed_claim, _ = _claim_processing(
        source_model=XrayAttachment,
        source_id=after_expiry.id,
        source_field="xray_attachment",
        user=doctor_user,
    )

    assert AIResult.objects.get(pk=renewed_claim.result_id).requested_by == doctor_user
    assert AIInvocationBucket.objects.get(
        scope=AIInvocationBucket.Scope.USER,
        key=str(doctor_user.id),
    ).request_count == 1


@pytest.mark.django_db
def test_global_invocation_budget_limits_distinct_users(
    settings,
    xray_attachment_factory,
    doctor_user,
    other_doctor_user,
):
    settings.PEARLIX_AI_MAX_INVOCATIONS_GLOBAL = 2
    third_user = User.objects.create_user(
        email="phase6-third-doctor@example.com",
        password="password123",
        full_name="Phase 6 Third Doctor",
        role=User.Role.DOCTOR,
    )
    users = [doctor_user, other_doctor_user, third_user]
    sources = [xray_attachment_factory(uploaded_by=user) for user in users]
    for source, user in zip(sources[:2], users[:2]):
        claim, _ = _claim_processing(
            source_model=XrayAttachment,
            source_id=source.id,
            source_field="xray_attachment",
            user=user,
        )
        _complete_claim(claim)

    with pytest.raises(AIRateLimited):
        _claim_processing(
            source_model=XrayAttachment,
            source_id=sources[2].id,
            source_field="xray_attachment",
            user=third_user,
        )
    assert not AIResult.objects.filter(xray_attachment=sources[2]).exists()


@pytest.mark.django_db
def test_failed_provider_attempt_counts_against_user_budget(
    monkeypatch,
    settings,
    doctor_client,
    xray_attachment_factory,
    doctor_user,
):
    settings.PEARLIX_AI_MAX_INVOCATIONS_PER_USER = 1
    first = xray_attachment_factory(uploaded_by=doctor_user)
    second = xray_attachment_factory(uploaded_by=doctor_user)
    monkeypatch.setattr(
        services._MOCK_ADAPTER,
        "analyze",
        lambda _image: (_ for _ in ()).throw(RuntimeError("provider failed")),
    )

    failed = doctor_client.post(f"/api/xrays/{first.id}/run-ai/")
    limited = doctor_client.post(f"/api/xrays/{second.id}/run-ai/")

    assert failed.status_code == 500
    assert AIResult.objects.get(xray_attachment=first).status == AIResult.Status.FAILED
    assert limited.status_code == 429
    assert limited.data["code"] == "AI_RATE_LIMITED"
    assert not AIResult.objects.filter(xray_attachment=second).exists()


@pytest.mark.django_db(transaction=True)
def test_postgresql_concurrent_final_global_budget_slot_is_single_claim(
    settings,
    xray_attachment_factory,
    doctor_user,
    other_doctor_user,
):
    if connection.vendor != "postgresql":
        pytest.skip("PostgreSQL row-lock interleaving proof")
    AIExecutionState.objects.get_or_create(pk=1)
    settings.PEARLIX_AI_MAX_INVOCATIONS_GLOBAL = 1
    sources = [
        xray_attachment_factory(uploaded_by=doctor_user),
        xray_attachment_factory(uploaded_by=other_doctor_user),
    ]
    users = [doctor_user, other_doctor_user]
    barrier = Barrier(2)

    def claim(payload):
        source_id, user_id = payload
        close_old_connections()
        barrier.wait(timeout=10)
        try:
            user = User.objects.get(pk=user_id)
            _claim_processing(
                source_model=XrayAttachment,
                source_id=source_id,
                source_field="xray_attachment",
                user=user,
            )
            return "accepted"
        except AIRateLimited:
            return "limited"
        finally:
            close_old_connections()

    with ThreadPoolExecutor(max_workers=2) as executor:
        outcomes = list(executor.map(claim, [(source.id, user.id) for source, user in zip(sources, users)]))

    assert sorted(outcomes) == ["accepted", "limited"]
    assert AIResult.objects.filter(status=AIResult.Status.PROCESSING).count() == 1
    assert AIInvocationBucket.objects.get(scope=AIInvocationBucket.Scope.CLINIC, key="clinic").request_count == 1


@pytest.mark.django_db(transaction=True)
def test_postgresql_concurrent_patient_overlays_never_overcommit_quota(
    monkeypatch,
    settings,
    xray_attachment_factory,
    doctor_user,
    other_doctor_user,
):
    if connection.vendor != "postgresql":
        pytest.skip("PostgreSQL row-lock interleaving proof")
    AIExecutionState.objects.get_or_create(pk=1)
    overlay = _overlay_png()
    sources = [
        xray_attachment_factory(uploaded_by=doctor_user),
        xray_attachment_factory(uploaded_by=other_doctor_user),
    ]
    settings.PEARLIX_AI_MAX_ACTIVE_JOBS_GLOBAL = 2
    settings.PEARLIX_XRAY_PATIENT_QUOTA_BYTES = sum(source.size_bytes for source in sources) + len(overlay)
    barrier = Barrier(2)

    class ConcurrentOverlayAdapter:
        model_version = "phase6-concurrent-overlay"

        def analyze(self, _image):
            barrier.wait(timeout=10)
            return PipelineResult(
                result_summary="Concurrent overlay result",
                model_version=self.model_version,
                overlay_png=overlay,
            )

    monkeypatch.setattr(
        services,
        "select_inference_adapter",
        lambda _mode: ConcurrentOverlayAdapter(),
    )

    def analyze(payload):
        source_id, user_id = payload
        close_old_connections()
        try:
            source = XrayAttachment.objects.get(pk=source_id)
            user = User.objects.get(pk=user_id)
            run_ai_for_xray(xray_attachment=source, user=user)
            return "completed"
        except AIStorageQuotaExceeded:
            return "quota"
        finally:
            close_old_connections()

    with ThreadPoolExecutor(max_workers=2) as executor:
        outcomes = list(
            executor.map(
                analyze,
                [(source.id, user.id) for source, user in zip(sources, [doctor_user, other_doctor_user])],
            )
        )

    assert sorted(outcomes) == ["completed", "quota"]
    assert AIResult.objects.filter(status=AIResult.Status.COMPLETED, overlay_size_bytes=len(overlay)).count() == 1
    failed = AIResult.objects.get(status=AIResult.Status.FAILED)
    assert failed.overlay_size_bytes == 0
    assert not failed.overlay_file
    enforce_storage_quota(
        additional_bytes=0,
        uploader_id=doctor_user.id,
        patient_id=sources[0].patient_id,
    )


@pytest.mark.django_db
def test_patient_quota_accepts_fitting_overlay_and_rejects_oversized_overlay_cleanly(
    monkeypatch,
    settings,
    xray_attachment_factory,
    doctor_user,
):
    overlay = _overlay_png()

    class OverlayAdapter:
        model_version = "phase6-overlay"

        def analyze(self, _image):
            return PipelineResult(
                result_summary="Overlay result",
                model_version=self.model_version,
                overlay_png=overlay,
            )

    monkeypatch.setattr(services, "select_inference_adapter", lambda _mode: OverlayAdapter())
    fitting = xray_attachment_factory(uploaded_by=doctor_user)
    settings.PEARLIX_XRAY_PATIENT_QUOTA_BYTES = fitting.size_bytes + len(overlay)
    completed = run_ai_for_xray(xray_attachment=fitting, user=doctor_user)
    assert completed.status == AIResult.Status.COMPLETED
    assert completed.overlay_size_bytes == len(overlay)

    fitting.delete()
    oversized = xray_attachment_factory(uploaded_by=doctor_user)
    settings.PEARLIX_XRAY_PATIENT_QUOTA_BYTES = oversized.size_bytes + len(overlay) - 1
    with pytest.raises(AIStorageQuotaExceeded):
        run_ai_for_xray(xray_attachment=oversized, user=doctor_user)
    failed = AIResult.objects.get(xray_attachment=oversized)
    assert failed.status == AIResult.Status.FAILED
    assert not failed.overlay_file
    assert failed.overlay_size_bytes == 0


@pytest.mark.django_db
def test_patient_quota_counts_all_retained_overlays_without_cross_patient_or_replacement_double_count(
    settings,
    patient_factory,
    xray_attachment_factory,
    ai_result_factory,
    doctor_user,
):
    patient = patient_factory()
    other_patient = patient_factory()
    first = xray_attachment_factory(patient=patient, uploaded_by=doctor_user)
    second = xray_attachment_factory(patient=patient, uploaded_by=doctor_user)
    other = xray_attachment_factory(patient=other_patient, uploaded_by=doctor_user)
    first_result = ai_result_factory(
        xray_attachment=first,
        requested_by=doctor_user,
        overlay_file="ai-overlays/first.png",
        overlay_size_bytes=30,
    )
    ai_result_factory(
        xray_attachment=second,
        requested_by=doctor_user,
        overlay_file="ai-overlays/second.png",
        overlay_size_bytes=40,
    )
    ai_result_factory(
        xray_attachment=other,
        requested_by=doctor_user,
        overlay_file="ai-overlays/other.png",
        overlay_size_bytes=90,
    )
    patient_total = first.size_bytes + second.size_bytes + 70
    settings.PEARLIX_XRAY_PATIENT_QUOTA_BYTES = patient_total

    enforce_storage_quota(additional_bytes=0, uploader_id=doctor_user.id, patient_id=patient.id)
    with pytest.raises(StorageQuotaExceeded) as caught:
        enforce_storage_quota(additional_bytes=1, uploader_id=doctor_user.id, patient_id=patient.id)
    assert caught.value.dimension == "patient"

    first_result.overlay_size_bytes = 35
    first_result.save(update_fields=["overlay_size_bytes", "updated_at"])
    settings.PEARLIX_XRAY_PATIENT_QUOTA_BYTES = first.size_bytes + second.size_bytes + 75
    enforce_storage_quota(additional_bytes=0, uploader_id=doctor_user.id, patient_id=patient.id)
    first_result.overlay_file = ""
    first_result.overlay_size_bytes = 0
    first_result.save(update_fields=["overlay_file", "overlay_size_bytes", "updated_at"])
    settings.PEARLIX_XRAY_PATIENT_QUOTA_BYTES = first.size_bytes + second.size_bytes + 40
    enforce_storage_quota(additional_bytes=0, uploader_id=doctor_user.id, patient_id=patient.id)

    settings.PEARLIX_XRAY_PATIENT_QUOTA_BYTES = other.size_bytes + 90
    enforce_storage_quota(additional_bytes=0, uploader_id=doctor_user.id, patient_id=other_patient.id)


@pytest.mark.django_db
def test_phase6_migration_backfills_historical_requester_from_source_owner(
    xray_attachment_factory,
    doctor_user,
):
    source = xray_attachment_factory(uploaded_by=doctor_user)
    historical = AIResult.objects.create(
        xray_attachment=source,
        requested_by=None,
        status=AIResult.Status.COMPLETED,
        result_summary="Historical result",
        model_version="historical",
    )
    migration = import_module(
        "apps.ai_results.migrations.0005_phase6_requester_and_invocation_budgets"
    )

    migration.backfill_requesters(django_apps, schema_editor=None)

    historical.refresh_from_db()
    assert historical.requested_by == doctor_user
