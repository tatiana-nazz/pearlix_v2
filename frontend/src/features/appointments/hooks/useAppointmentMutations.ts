import { useMutation, useQueryClient } from "@tanstack/react-query";

import {
  cancelAppointment,
  checkInAppointment,
  createAppointment,
  markAppointmentNoShow,
  startAppointmentVisit,
  updateAppointment,
} from "../../../api/endpoints/appointments";
import type { CreateAppointmentPayload, UpdateAppointmentPayload } from "../../../types/appointments";
import { appointmentKey } from "./useAppointments";

function invalidateAppointments(queryClient: ReturnType<typeof useQueryClient>, appointmentId?: number, patientId?: number) {
  void queryClient.invalidateQueries({ queryKey: ["appointments"] });
  void queryClient.invalidateQueries({ queryKey: ["appointment-availability"] });
  void queryClient.invalidateQueries({ queryKey: ["patients"] });
  void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  if (appointmentId) void queryClient.invalidateQueries({ queryKey: appointmentKey(appointmentId) });
  if (patientId) void queryClient.invalidateQueries({ queryKey: ["patient", patientId] });
}

export function useCreateAppointment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateAppointmentPayload) => createAppointment(payload),
    onSuccess: (appointment) => invalidateAppointments(queryClient, appointment.id, appointment.patient.id),
  });
}

export function useUpdateAppointment(appointmentId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdateAppointmentPayload) => updateAppointment(appointmentId, payload),
    onSuccess: (appointment) => invalidateAppointments(queryClient, appointment.id, appointment.patient.id),
  });
}

export function useCheckInAppointment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (appointmentId: number) => checkInAppointment(appointmentId),
    onSuccess: (appointment) => invalidateAppointments(queryClient, appointment.id, appointment.patient.id),
  });
}

export function useCancelAppointment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (appointmentId: number) => cancelAppointment(appointmentId),
    onSuccess: (appointment) => invalidateAppointments(queryClient, appointment.id, appointment.patient.id),
  });
}

export function useNoShowAppointment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (appointmentId: number) => markAppointmentNoShow(appointmentId),
    onSuccess: (appointment) => invalidateAppointments(queryClient, appointment.id, appointment.patient.id),
  });
}

export function useStartAppointmentVisit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (appointmentId: number) => startAppointmentVisit(appointmentId),
    onSuccess: (visit) => invalidateAppointments(queryClient, visit.appointment.id, visit.patient.id),
  });
}
