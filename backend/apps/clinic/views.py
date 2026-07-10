from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView
from rest_framework.response import Response

from apps.audit.services import log_activity
from apps.clinic.models import ClinicSettings
from apps.clinic.serializers import ClinicSafeSettingsSerializer, ClinicSettingsSerializer
from apps.common.permissions import IsAdminRole


class ClinicSettingsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        settings = ClinicSettings.get_solo()
        serializer_class = ClinicSettingsSerializer if request.user.role == "ADMIN" else ClinicSafeSettingsSerializer
        return Response(serializer_class(settings).data)

    def patch(self, request):
        admin_permission = IsAdminRole()
        if not admin_permission.has_permission(request, self):
            self.permission_denied(request)

        settings = ClinicSettings.get_solo()
        serializer = ClinicSettingsSerializer(settings, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        settings = serializer.save()
        log_activity(
            request=request,
            action="clinic_settings_updated",
            entity_type="clinic_settings",
            entity_id=settings.id,
            metadata={"updated_fields": sorted(request.data.keys())},
        )
        return Response(serializer.data)
