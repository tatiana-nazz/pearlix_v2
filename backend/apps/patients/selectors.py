from django.db.models import OuterRef, Q, QuerySet, Subquery
from django.utils import timezone

from apps.patients.models import Patient
from apps.scheduling.models import Appointment
from apps.visits.models import Visit


ARCHIVE_BLOCKING_APPOINTMENT_STATUSES = (
    Appointment.Status.UPCOMING,
    Appointment.Status.CHECKED_IN,
    Appointment.Status.ACTIVE,
    Appointment.Status.NEEDS_RESCHEDULE,
)


def get_patients_for_user(user) -> QuerySet[Patient]:
    queryset = Patient.objects.select_related("created_by", "updated_by")
    if not user or not user.is_authenticated:
        return queryset.none()
    if user.role in {"ADMIN", "STAFF"}:
        return queryset.all()
    if user.role == "DOCTOR":
        if not user.is_active:
            return queryset.none()
        return queryset.filter(is_archived=False)
    return queryset.none()


def annotate_patient_directory(queryset: QuerySet[Patient]) -> QuerySet[Patient]:
    """Add read-only directory dates without per-row frontend requests."""
    last_visit = Visit.objects.filter(patient_id=OuterRef("pk")).order_by("-started_at", "-id").values("started_at")[:1]
    next_appointment = Appointment.objects.filter(
        patient_id=OuterRef("pk"),
        start_datetime__gte=timezone.now(),
        status__in=(
            Appointment.Status.UPCOMING,
            Appointment.Status.CHECKED_IN,
            Appointment.Status.NEEDS_RESCHEDULE,
        ),
    ).order_by("start_datetime", "id").values("start_datetime")[:1]
    return queryset.annotate(
        last_visit_at=Subquery(last_visit),
        next_appointment_at=Subquery(next_appointment),
    )


def get_doctor_related_patients(user) -> QuerySet[Patient]:
    if not user or not user.is_authenticated or user.role != "DOCTOR" or not user.is_active:
        return Patient.objects.none()
    return Patient.objects.filter(Q(appointments__doctor=user) | Q(visits__doctor=user)).distinct()


def get_doctor_upcoming_patients(user) -> QuerySet[Patient]:
    if not user or not user.is_authenticated or user.role != "DOCTOR" or not user.is_active:
        return Patient.objects.none()
    return Patient.objects.filter(
        appointments__doctor=user,
        appointments__status__in=[Appointment.Status.UPCOMING, Appointment.Status.CHECKED_IN],
        appointments__start_datetime__gte=timezone.now(),
    ).distinct()


def user_can_read_patient_profile(user, patient: Patient) -> bool:
    if not user or not user.is_authenticated:
        return False
    if user.role in {"ADMIN", "STAFF"}:
        return True
    return user.role == "DOCTOR" and user.is_active and not patient.is_archived


def user_can_access_patient(user, patient: Patient) -> bool:
    return user_can_read_patient_profile(user, patient)


def user_can_read_patient_clinical_history(user, patient: Patient) -> bool:
    return user_can_read_patient_profile(user, patient)


def patient_has_archive_blocking_appointments(patient: Patient) -> bool:
    return patient.appointments.filter(status__in=ARCHIVE_BLOCKING_APPOINTMENT_STATUSES).exists()
