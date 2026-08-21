from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView
from rest_framework.response import Response

from apps.clinic.models import ClinicSettings
from apps.clinic.serializers import ClinicSafeSettingsSerializer, ClinicSettingsSerializer
from apps.common.permissions import IsAdminRole
from apps.scheduling.appointment_services import AppointmentRuleError
from apps.scheduling.clinic_week_services import update_clinic_settings


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
        try:
            settings, impact = update_clinic_settings(
                settings=settings,
                validated_data=serializer.validated_data,
                actor=request.user,
                request=request,
            )
        except AppointmentRuleError as exc:
            return exc.to_response()
        return Response({**ClinicSettingsSerializer(settings).data, **impact})
