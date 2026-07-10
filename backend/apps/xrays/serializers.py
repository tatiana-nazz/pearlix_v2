from rest_framework import serializers

from apps.accounts.serializers import UserSummarySerializer
from apps.patients.serializers import PatientListSerializer
from apps.xrays.models import ExternalXrayCase, XrayAttachment


class XrayVisitSummarySerializer(serializers.Serializer):
    id = serializers.IntegerField(read_only=True)
    status = serializers.CharField(read_only=True)
    started_at = serializers.DateTimeField(read_only=True)
    completed_at = serializers.DateTimeField(read_only=True)


class XrayAttachmentSerializer(serializers.ModelSerializer):
    patient = PatientListSerializer(read_only=True)
    visit = XrayVisitSummarySerializer(read_only=True)
    uploaded_by = UserSummarySerializer(read_only=True)
    file_endpoint = serializers.SerializerMethodField()
    ai_result_endpoint = serializers.SerializerMethodField()
    ai_overlay_endpoint = serializers.SerializerMethodField()
    has_ai_result = serializers.SerializerMethodField()

    class Meta:
        model = XrayAttachment
        fields = (
            "id",
            "patient",
            "visit",
            "uploaded_by",
            "source",
            "title",
            "notes",
            "stored_file_name",
            "original_file_name",
            "content_type",
            "size_bytes",
            "file_endpoint",
            "ai_result_endpoint",
            "ai_overlay_endpoint",
            "has_ai_result",
            "created_at",
            "updated_at",
        )
        read_only_fields = fields

    def get_file_endpoint(self, obj):
        return f"/api/xrays/{obj.id}/file/"

    def get_ai_result_endpoint(self, obj):
        return f"/api/xrays/{obj.id}/ai-result/"

    def get_ai_overlay_endpoint(self, obj):
        return f"/api/xrays/{obj.id}/ai-overlay/"

    def get_has_ai_result(self, obj):
        return hasattr(obj, "ai_result")


class ExternalXrayCaseSerializer(serializers.ModelSerializer):
    uploaded_by = UserSummarySerializer(read_only=True)
    attached_patient = PatientListSerializer(read_only=True)
    attached_visit = XrayVisitSummarySerializer(read_only=True)
    attached_xray = XrayAttachmentSerializer(read_only=True)
    file_endpoint = serializers.SerializerMethodField()
    ai_result_endpoint = serializers.SerializerMethodField()
    ai_overlay_endpoint = serializers.SerializerMethodField()
    has_ai_result = serializers.SerializerMethodField()

    class Meta:
        model = ExternalXrayCase
        fields = (
            "id",
            "uploaded_by",
            "title",
            "notes",
            "status",
            "stored_file_name",
            "original_file_name",
            "content_type",
            "size_bytes",
            "attached_patient",
            "attached_visit",
            "attached_xray",
            "discarded_at",
            "attached_at",
            "file_endpoint",
            "ai_result_endpoint",
            "ai_overlay_endpoint",
            "has_ai_result",
            "created_at",
            "updated_at",
        )
        read_only_fields = fields

    def get_file_endpoint(self, obj):
        return f"/api/external-xrays/{obj.id}/file/"

    def get_ai_result_endpoint(self, obj):
        return f"/api/external-xrays/{obj.id}/ai-result/"

    def get_ai_overlay_endpoint(self, obj):
        return f"/api/external-xrays/{obj.id}/ai-overlay/"

    def get_has_ai_result(self, obj):
        return hasattr(obj, "ai_result")
