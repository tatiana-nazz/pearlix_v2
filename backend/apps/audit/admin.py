from django.contrib import admin

from apps.audit.models import ActivityLog


@admin.register(ActivityLog)
class ActivityLogAdmin(admin.ModelAdmin):
    list_display = ("id", "action", "entity_type", "entity_id", "actor", "actor_role", "created_at")
    list_filter = ("action", "actor_role", "entity_type", "created_at")
    search_fields = ("action", "entity_type", "entity_id", "actor__email", "actor__full_name")
    readonly_fields = (
        "id",
        "actor",
        "actor_role",
        "action",
        "entity_type",
        "entity_id",
        "metadata_json",
        "ip_address",
        "user_agent",
        "created_at",
    )

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
