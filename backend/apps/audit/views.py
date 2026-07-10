from rest_framework.pagination import PageNumberPagination
from rest_framework.viewsets import ReadOnlyModelViewSet

from apps.audit.models import ActivityLog
from apps.audit.permissions import IsAuditAdmin
from apps.audit.serializers import ActivityLogSerializer


class ActivityLogPagination(PageNumberPagination):
    page_size = 20


class ActivityLogViewSet(ReadOnlyModelViewSet):
    serializer_class = ActivityLogSerializer
    permission_classes = [IsAuditAdmin]
    pagination_class = ActivityLogPagination
    http_method_names = ["get", "head", "options"]

    def get_queryset(self):
        queryset = ActivityLog.objects.select_related("actor").all()

        actor_id = self.request.query_params.get("actor_id")
        actor_role = self.request.query_params.get("actor_role")
        action = self.request.query_params.get("action")
        entity_type = self.request.query_params.get("entity_type")
        entity_id = self.request.query_params.get("entity_id")
        created_from = self.request.query_params.get("created_from")
        created_to = self.request.query_params.get("created_to")

        if actor_id:
            queryset = queryset.filter(actor_id=actor_id)
        if actor_role:
            queryset = queryset.filter(actor_role=actor_role)
        if action:
            queryset = queryset.filter(action=action)
        if entity_type:
            queryset = queryset.filter(entity_type=entity_type)
        if entity_id:
            queryset = queryset.filter(entity_id=str(entity_id))
        if created_from:
            queryset = queryset.filter(created_at__gte=created_from)
        if created_to:
            queryset = queryset.filter(created_at__lte=created_to)
        return queryset
