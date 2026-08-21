from django.contrib import admin


class ServiceOwnedReadOnlyAdmin(admin.ModelAdmin):
    """Diagnostic admin for records whose mutations belong to domain services."""

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
