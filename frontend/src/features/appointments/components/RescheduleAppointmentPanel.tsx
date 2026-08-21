import { useEffect, useMemo, useState } from "react";

import { Card } from "../../../components/Card";
import type { AppointmentDetail, UpdateAppointmentPayload, AvailabilitySlot } from "../../../types/appointments";
import type { DoctorListItem } from "../../../types/schedule";
import { formatDateRange } from "../../../utils/dates";
import { useAppointmentAvailability } from "../hooks/useAppointments";
import { appointmentToFormValues, formValuesToUpdatePayload } from "../utils/appointmentFormMapping";
import { AvailabilityPicker } from "./AvailabilityPicker";

interface RescheduleAppointmentPanelProps {
  appointment: AppointmentDetail;
  doctors: DoctorListItem[];
  isSubmitting?: boolean;
  error?: unknown;
  clinicTimezone?: string;
  onSubmit: (payload: UpdateAppointmentPayload) => void | Promise<void>;
}

export function RescheduleAppointmentPanel({ appointment, doctors, isSubmitting, error, clinicTimezone, onSubmit }: RescheduleAppointmentPanelProps) {
  const initial = appointmentToFormValues(appointment, clinicTimezone);
  const [doctorId, setDoctorId] = useState(initial.doctorId);
  const [date, setDate] = useState(initial.date);
  const [durationMinutes, setDurationMinutes] = useState(initial.durationMinutes);
  const [selectedSlot, setSelectedSlot] = useState<AvailabilitySlot | null>(null);
  const filters = useMemo(
    () =>
      Number(doctorId) && date
        ? { doctor_id: Number(doctorId), date, duration_minutes: Number(durationMinutes) || appointment.duration_minutes }
        : null,
    [date, doctorId, durationMinutes, appointment.duration_minutes],
  );
  const availability = useAppointmentAvailability(filters);
  useEffect(() => setSelectedSlot(null), [doctorId, date, durationMinutes]);

  async function submit() {
    if (!selectedSlot) return;
    const slot = selectedSlot.start_datetime;
    await onSubmit({
      patient_id: appointment.patient.id,
      doctor_id: Number(doctorId),
      start_datetime: slot,
      duration_minutes: Number(durationMinutes),
      reason: appointment.reason,
      notes: appointment.notes,
      version: appointment.version,
    });
  }

  return (
    <div className="reschedule-grid">
      <Card>
        <p className="eyebrow">Current appointment</p>
        <h3>{appointment.patient.full_name}</h3>
        <p>{formatDateRange(appointment.start_datetime, appointment.end_datetime)}</p>
        <p className="panel-note">Saving a new slot returns a NEEDS_RESCHEDULE appointment to UPCOMING through the backend update service.</p>
      </Card>
      <Card>
        {error ? <p className="form-error">Unable to save reschedule. Review the slot and try again.</p> : null}
        <div className="appointment-form-grid">
          <label>
            Doctor
            <select value={doctorId} onChange={(event) => setDoctorId(event.target.value)}>
              {doctors.map((doctor) => (
                <option key={doctor.id} value={doctor.id}>
                  {doctor.full_name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Date
            <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
          </label>
          <label>
            Duration
            <input value={durationMinutes} inputMode="numeric" onChange={(event) => setDurationMinutes(event.target.value)} />
          </label>
        </div>
        <AvailabilityPicker
          availability={availability.data}
          isLoading={availability.isLoading}
          error={availability.error}
          selectedStart={selectedSlot?.start_datetime}
          onSelect={setSelectedSlot}
          onRetry={() => void availability.refetch()}
        />
        <div className="form-actions">
          <button className="button primary" type="button" disabled={isSubmitting || !selectedSlot} onClick={() => void submit()}>
            Save reschedule
          </button>
        </div>
      </Card>
    </div>
  );
}
