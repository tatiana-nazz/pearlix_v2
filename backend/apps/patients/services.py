from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from django.db import transaction
from rest_framework import status

from apps.common.errors import error_response
from apps.patients.models import Patient
from apps.patients.selectors import ARCHIVE_BLOCKING_APPOINTMENT_STATUSES, patient_has_archive_blocking_appointments


class PatientVersionError(Exception):
    code = "VERSION_ERROR"
    message = "Patient version error."
    status_code = status.HTTP_400_BAD_REQUEST

    def __init__(self, *, submitted_version: int | None = None, current_version: int | None = None):
        super().__init__(self.message)
        self.submitted_version = submitted_version
        self.current_version = current_version

    def to_response(self):
        details: dict[str, Any] = {}
        if self.submitted_version is not None:
            details["submitted_version"] = self.submitted_version
        if self.current_version is not None:
            details["current_version"] = self.current_version
        return error_response(self.code, self.message, details, status_code=self.status_code)


class PatientVersionConflict(PatientVersionError):
    code = "VERSION_CONFLICT"
    message = "Patient was modified by another request."
    status_code = status.HTTP_409_CONFLICT


@dataclass(frozen=True)
class ArchiveBlocked(Exception):
    blocking_statuses: tuple[str, ...] = ARCHIVE_BLOCKING_APPOINTMENT_STATUSES

    def to_response(self):
        return error_response(
            "ARCHIVE_BLOCKED",
            "Patient cannot be archived while active operational appointments exist.",
            {"blocking_statuses": list(self.blocking_statuses)},
            status_code=status.HTTP_409_CONFLICT,
        )


def parse_required_version(raw_version) -> int:
    if raw_version in (None, ""):
        raise ValueError
    return int(raw_version)


def update_patient_with_version(*, patient: Patient, validated_data: dict[str, Any], submitted_version: int, user) -> Patient:
    with transaction.atomic():
        locked_patient = Patient.objects.select_for_update().get(pk=patient.pk)
        if locked_patient.version != submitted_version:
            raise PatientVersionConflict(submitted_version=submitted_version, current_version=locked_patient.version)

        update_fields = []
        for field, value in validated_data.items():
            setattr(locked_patient, field, value)
            update_fields.append(field)

        locked_patient.version += 1
        locked_patient.updated_by = user
        update_fields.extend(["version", "updated_by", "updated_at"])
        locked_patient.save(update_fields=sorted(set(update_fields)))
        return locked_patient


def set_patient_archive_state_with_version(*, patient: Patient, is_archived: bool, submitted_version: int, user) -> Patient:
    with transaction.atomic():
        locked_patient = Patient.objects.select_for_update().get(pk=patient.pk)
        if locked_patient.version != submitted_version:
            raise PatientVersionConflict(submitted_version=submitted_version, current_version=locked_patient.version)

        if is_archived and not locked_patient.is_archived and patient_has_archive_blocking_appointments(locked_patient):
            raise ArchiveBlocked()

        locked_patient.is_archived = is_archived
        locked_patient.version += 1
        locked_patient.updated_by = user
        locked_patient.save(update_fields=["is_archived", "version", "updated_by", "updated_at"])
        return locked_patient
