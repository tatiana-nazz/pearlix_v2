from django.db import transaction
from rest_framework import status

from apps.ai_results.models import AIResult
from apps.clinic.models import ClinicSettings
from apps.common.errors import error_response


MOCK_MODEL_VERSION = "pearlix-mock-xray-v1"


class AIServiceNotConfigured(Exception):
    def to_response(self):
        return error_response(
            "AI_SERVICE_NOT_CONFIGURED",
            "AI service is not configured for the selected AI mode.",
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        )


def _ensure_mock_adapter_enabled():
    settings = ClinicSettings.get_solo()
    if settings.ai_mode != ClinicSettings.AiMode.MOCK_ADAPTER:
        raise AIServiceNotConfigured


def run_mock_xray_analysis(xray_attachment):
    return {
        "status": AIResult.Status.COMPLETED,
        "result_summary": "Research-only AI analysis completed.",
        "overall_confidence": 0.74,
        "findings_json": [
            {
                "fdi_tooth_id": "36",
                "disease_label": "Caries",
                "confidence_score": 0.82,
                "confidence_percent": 82,
            }
        ],
        "model_version": MOCK_MODEL_VERSION,
        "error_message": "",
    }


def run_ai_for_xray(*, xray_attachment, user):
    _ensure_mock_adapter_enabled()
    data = run_mock_xray_analysis(xray_attachment)
    with transaction.atomic():
        result, _ = AIResult.objects.update_or_create(
            xray_attachment=xray_attachment,
            defaults=data,
        )
        result.full_clean()
        result.save()
        return result


def run_ai_for_external_case(*, external_xray_case, user):
    _ensure_mock_adapter_enabled()
    data = run_mock_xray_analysis(external_xray_case)
    with transaction.atomic():
        result, _ = AIResult.objects.update_or_create(
            external_xray_case=external_xray_case,
            defaults=data,
        )
        result.full_clean()
        result.save()
        return result
