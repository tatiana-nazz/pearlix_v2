from rest_framework import serializers

from apps.accounts.serializers import UserSummarySerializer
from apps.audit.models import ActivityLog


class ActivityLogSerializer(serializers.ModelSerializer):
    actor = UserSummarySerializer(read_only=True)

    class Meta:
        model = ActivityLog
        fields = (
            "id",
            "actor",
            "actor_role",
            "action",
            "entity_type",
            "entity_id",
            "metadata_json",
            "ip_address",
            "created_at",
        )
        read_only_fields = fields
