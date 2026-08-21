from django.contrib import admin

from apps.ai_results.models import AIResult
from apps.common.admin import ServiceOwnedReadOnlyAdmin


@admin.register(AIResult)
class AIResultAdmin(ServiceOwnedReadOnlyAdmin):
    list_display = ("xray_attachment", "requested_by", "status", "overall_confidence", "model_version", "created_at")
    list_filter = ("status", "model_version")
    search_fields = (
        "xray_attachment__original_file_name",
        "xray_attachment__patient__first_name",
        "xray_attachment__patient__last_name",
        "requested_by__email",
    )
