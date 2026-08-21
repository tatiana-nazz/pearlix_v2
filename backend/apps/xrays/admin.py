from django.contrib import admin

from apps.xrays.models import ExternalXrayCase, XrayAttachment
from apps.common.admin import ServiceOwnedReadOnlyAdmin


@admin.register(XrayAttachment)
class XrayAttachmentAdmin(ServiceOwnedReadOnlyAdmin):
    list_display = ("patient", "visit", "uploaded_by", "source", "original_file_name", "content_type", "size_bytes", "created_at")
    list_filter = ("content_type", "source")
    search_fields = ("patient__first_name", "patient__last_name", "patient__phone_number", "uploaded_by__email", "uploaded_by__full_name", "original_file_name")


@admin.register(ExternalXrayCase)
class ExternalXrayCaseAdmin(ServiceOwnedReadOnlyAdmin):
    list_display = ("uploaded_by", "status", "original_file_name", "content_type", "size_bytes", "attached_patient", "created_at")
    list_filter = ("status", "content_type")
    search_fields = ("uploaded_by__email", "uploaded_by__full_name", "original_file_name", "attached_patient__first_name", "attached_patient__last_name")
