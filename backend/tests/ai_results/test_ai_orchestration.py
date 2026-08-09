from datetime import timedelta
from io import BytesIO

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.utils import timezone

from apps.ai_results import services
from apps.ai_results.adapters import InferenceAdapter, MockInferenceAdapter
from apps.ai_results.models import AIResult
from apps.ai_results.result_types import ImageInput
from apps.audit.models import ActivityLog
from apps.clinic.models import ClinicSettings
from apps.xrays.models import ExternalXrayCase


@pytest.fixture(autouse=True)
def temp_media_root(settings, tmp_path):
    settings.MEDIA_ROOT = tmp_path


def test_mock_adapter_implements_framework_neutral_protocol():
    adapter = MockInferenceAdapter()

    assert isinstance(adapter, InferenceAdapter)
    result = adapter.analyze(ImageInput(content=b"image", content_type="image/png"))
    assert result.model_version == "pearlix-mock-xray-v1"
    assert result.overall_confidence == 0.74
    assert result.simplified_findings()[0].fdi_tooth_id == "36"


def test_storage_neutral_loader_never_requires_path():
    class StorageOnlyField:
        @property
        def path(self):
            raise AssertionError(".path must not be used")

        def open(self, mode):
            assert mode == "rb"
            return BytesIO(b"storage-backed-image")

    image = services.load_image_input(StorageOnlyField(), content_type="image/png")

    assert image.content == b"storage-backed-image"
    assert image.content_type == "image/png"


@pytest.mark.django_db
def test_result_is_processing_during_adapter_call_and_completed_afterward(
    doctor_client,
    xray_attachment_factory,
    monkeypatch,
):
    xray = xray_attachment_factory()

    def analyze(image):
        result = AIResult.objects.get(xray_attachment=xray)
        assert result.status == AIResult.Status.PROCESSING
        return MockInferenceAdapter().analyze(image)

    monkeypatch.setattr(services._MOCK_ADAPTER, "analyze", analyze)
    response = doctor_client.post(f"/api/xrays/{xray.id}/run-ai/")

    assert response.status_code == 200
    assert AIResult.objects.get(xray_attachment=xray).status == AIResult.Status.COMPLETED


@pytest.mark.django_db
def test_active_processing_duplicate_is_stable_409_without_new_row(
    doctor_client,
    xray_attachment_factory,
    ai_result_factory,
):
    xray = xray_attachment_factory()
    result = ai_result_factory(xray_attachment=xray, status=AIResult.Status.PROCESSING, model_version="")

    response = doctor_client.post(f"/api/xrays/{xray.id}/run-ai/")

    assert response.status_code == 409
    assert response.data["code"] == "AI_ANALYSIS_IN_PROGRESS"
    assert response.data["details"]["result_id"] == result.id
    assert AIResult.objects.filter(xray_attachment=xray).count() == 1


@pytest.mark.django_db
def test_stale_processing_claim_is_recovered(
    settings,
    doctor_client,
    xray_attachment_factory,
    ai_result_factory,
):
    settings.PEARLIX_AI_PROCESSING_STALE_SECONDS = 60
    xray = xray_attachment_factory()
    result = ai_result_factory(xray_attachment=xray, status=AIResult.Status.PROCESSING, model_version="")
    AIResult.objects.filter(pk=result.pk).update(updated_at=timezone.now() - timedelta(minutes=2))

    response = doctor_client.post(f"/api/xrays/{xray.id}/run-ai/")

    result.refresh_from_db()
    assert response.status_code == 200
    assert result.status == AIResult.Status.COMPLETED
    assert AIResult.objects.filter(xray_attachment=xray).count() == 1


@pytest.mark.django_db
def test_adapter_failure_persists_safe_failed_result_and_audit_event(
    doctor_client,
    xray_attachment_factory,
    monkeypatch,
):
    xray = xray_attachment_factory()

    def fail(_image):
        raise RuntimeError("sensitive internal model failure")

    monkeypatch.setattr(services._MOCK_ADAPTER, "analyze", fail)
    response = doctor_client.post(f"/api/xrays/{xray.id}/run-ai/")

    result = AIResult.objects.get(xray_attachment=xray)
    assert response.status_code == 500
    assert response.data["code"] == "AI_ANALYSIS_FAILED"
    assert result.status == AIResult.Status.FAILED
    assert result.error_message == "AI analysis failed."
    assert "sensitive" not in str(response.data)
    assert set(
        ActivityLog.objects.filter(entity_type="ai_result", entity_id=str(result.id)).values_list("action", flat=True)
    ) == {
        "xray_ai_failed"
    }


@pytest.mark.django_db
def test_failed_result_retries_in_place_to_completion(
    doctor_client,
    xray_attachment_factory,
    ai_result_factory,
):
    xray = xray_attachment_factory()
    result = ai_result_factory(
        xray_attachment=xray,
        status=AIResult.Status.FAILED,
        model_version="",
        error_message="AI analysis failed.",
    )

    response = doctor_client.post(f"/api/xrays/{xray.id}/run-ai/")

    result.refresh_from_db()
    assert response.status_code == 200
    assert result.status == AIResult.Status.COMPLETED
    assert result.error_message == ""
    assert AIResult.objects.filter(xray_attachment=xray).count() == 1


@pytest.mark.django_db
def test_success_records_requested_completed_and_legacy_audit_events(
    doctor_client,
    xray_attachment_factory,
):
    xray = xray_attachment_factory()

    response = doctor_client.post(f"/api/xrays/{xray.id}/run-ai/")

    assert response.status_code == 200
    actions = set(ActivityLog.objects.values_list("action", flat=True))
    assert {"xray_ai_requested", "xray_ai_completed", "xray_ai_run"} <= actions


@pytest.mark.django_db
def test_external_attach_and_discard_are_blocked_while_processing(
    doctor_client,
    active_visit,
    external_xray_case_factory,
    ai_result_factory,
):
    attach_case = external_xray_case_factory()
    discard_case = external_xray_case_factory(stored_file_name="processing-discard.png")
    ai_result_factory(external_xray_case=attach_case, status=AIResult.Status.PROCESSING, model_version="")
    ai_result_factory(external_xray_case=discard_case, status=AIResult.Status.PROCESSING, model_version="")

    attach_response = doctor_client.post(
        f"/api/external-xrays/{attach_case.id}/attach-to-patient/",
        {"patient_id": active_visit.patient_id, "visit_id": active_visit.id},
        format="json",
    )
    discard_response = doctor_client.post(f"/api/external-xrays/{discard_case.id}/discard/")

    assert attach_response.status_code == 409
    assert attach_response.data["code"] == "AI_ANALYSIS_IN_PROGRESS"
    assert discard_response.status_code == 409
    assert discard_response.data["code"] == "AI_ANALYSIS_IN_PROGRESS"
    attach_case.refresh_from_db()
    discard_case.refresh_from_db()
    assert attach_case.status == ExternalXrayCase.Status.TEMPORARY
    assert discard_case.status == ExternalXrayCase.Status.TEMPORARY


@pytest.mark.django_db
def test_external_attach_copies_overlay_to_independent_storage_key(
    doctor_client,
    active_visit,
    external_xray_case_factory,
    ai_result_factory,
):
    external = external_xray_case_factory()
    external_result = ai_result_factory(
        external_xray_case=external,
        overlay_file=SimpleUploadedFile(
            "external-overlay.png",
            b"\x89PNG\r\n\x1a\nindependent-copy",
            content_type="image/png",
        ),
        findings_json={"schema_version": "fixture-v1", "display_findings": [{"model_score": 0.8}]},
    )

    response = doctor_client.post(
        f"/api/external-xrays/{external.id}/attach-to-patient/",
        {"patient_id": active_visit.patient_id, "visit_id": active_visit.id},
        format="json",
    )

    assert response.status_code == 200
    external.refresh_from_db()
    saved_result = external.attached_xray.ai_result
    assert saved_result.overlay_file.name != external_result.overlay_file.name
    assert saved_result.findings_json == external_result.findings_json
    with external_result.overlay_file.open("rb") as source, saved_result.overlay_file.open("rb") as copied:
        assert source.read() == copied.read()


@pytest.mark.django_db
def test_django_internal_selection_is_safe_until_real_adapter_exists():
    with pytest.raises(services.AIServiceNotConfigured) as exc_info:
        services.select_inference_adapter(ClinicSettings.AiMode.DJANGO_INTERNAL)

    assert exc_info.value.code == "AI_SERVICE_NOT_CONFIGURED"
