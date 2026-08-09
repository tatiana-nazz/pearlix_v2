from rest_framework import serializers

from apps.ai_results.models import AIResult


AI_DISCLAIMER_EN = "Research-only AI assistance. Not a clinical diagnosis."
AI_DISCLAIMER_AR = "مساعدة ذكاء اصطناعي لأغراض بحثية فقط. ليست تشخيصاً طبياً."


class AIResultSerializer(serializers.ModelSerializer):
    xray_attachment = serializers.SerializerMethodField()
    external_xray_case = serializers.SerializerMethodField()
    findings = serializers.SerializerMethodField()
    overall_confidence_percent = serializers.SerializerMethodField()
    overlay_available = serializers.SerializerMethodField()
    disclaimer = serializers.SerializerMethodField()
    disclaimer_ar = serializers.SerializerMethodField()

    class Meta:
        model = AIResult
        fields = (
            "id",
            "xray_attachment",
            "external_xray_case",
            "status",
            "result_summary",
            "overall_confidence",
            "overall_confidence_percent",
            "findings",
            "overlay_available",
            "model_version",
            "error_message",
            "disclaimer",
            "disclaimer_ar",
            "created_at",
            "updated_at",
        )
        read_only_fields = fields

    def get_xray_attachment(self, obj):
        if not obj.xray_attachment_id:
            return None
        xray = obj.xray_attachment
        return {
            "id": xray.id,
            "patient_id": xray.patient_id,
            "visit_id": xray.visit_id,
            "title": xray.title,
            "original_file_name": xray.original_file_name,
            "created_at": xray.created_at,
        }

    def get_external_xray_case(self, obj):
        if not obj.external_xray_case_id:
            return None
        external = obj.external_xray_case
        return {
            "id": external.id,
            "status": external.status,
            "title": external.title,
            "original_file_name": external.original_file_name,
            "created_at": external.created_at,
        }

    def get_findings(self, obj):
        findings = obj.findings_json or []
        if isinstance(findings, list):
            return findings
        if isinstance(findings, dict):
            display_findings = findings.get("display_findings", [])
            return display_findings if isinstance(display_findings, list) else []
        return []

    def get_overall_confidence_percent(self, obj):
        if obj.overall_confidence is None:
            return None
        return round(obj.overall_confidence * 100)

    def get_overlay_available(self, obj):
        return bool(obj.overlay_file)

    def get_disclaimer(self, obj):
        return AI_DISCLAIMER_EN

    def get_disclaimer_ar(self, obj):
        return AI_DISCLAIMER_AR
