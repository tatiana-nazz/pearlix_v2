from django.contrib import admin

from apps.audit.models import ActivityLog


@admin.register(ActivityLog)
class ActivityLogAdmin(admin.ModelAdmin):
    list_display = ("id", "action", "entity_type", "entity_id", "actor", "actor_role", "created_at")
    list_filter = ("action", "actor_role", "entity_type", "created_at")
    search_fields = ("action", "entity_type", "entity_id", "actor__email", "actor__full_name")
    readonly_fields = ("created_at",)
