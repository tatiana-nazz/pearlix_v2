from django.contrib import admin

from apps.xrays.models import ExternalXrayCase, XrayAttachment


@admin.register(XrayAttachment)
class XrayAttachmentAdmin(admin.ModelAdmin):
    list_display = ("patient", "visit", "uploaded_by", "source", "original_file_name", "content_type", "size_bytes", "created_at")
    list_filter = ("content_type", "source")
    search_fields = ("patient__full_name", "patient__phone", "uploaded_by__email", "uploaded_by__full_name", "original_file_name")


@admin.register(ExternalXrayCase)
class ExternalXrayCaseAdmin(admin.ModelAdmin):
    list_display = ("uploaded_by", "status", "original_file_name", "content_type", "size_bytes", "attached_patient", "created_at")
    list_filter = ("status", "content_type")
    search_fields = ("uploaded_by__email", "uploaded_by__full_name", "original_file_name", "attached_patient__full_name")
