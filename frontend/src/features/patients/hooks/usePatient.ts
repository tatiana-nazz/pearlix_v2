import { useQuery } from "@tanstack/react-query";

import {
  getPatient,
  getPatientAiResults,
  getPatientAppointments,
  getPatientVisits,
  getPatientXrays,
} from "../../../api/endpoints/patients";

export function patientKey(patientId: number) {
  return ["patient", patientId] as const;
}

export function usePatient(patientId: number) {
  return useQuery({
    queryKey: patientKey(patientId),
    queryFn: () => getPatient(patientId),
    enabled: Number.isFinite(patientId) && patientId > 0,
  });
}

export function usePatientVisits(patientId: number, enabled = true) {
  return useQuery({
    queryKey: ["patient", patientId, "visits"],
    queryFn: () => getPatientVisits(patientId),
    enabled,
  });
}

export function usePatientAppointments(patientId: number, enabled = true) {
  return useQuery({
    queryKey: ["patient", patientId, "appointments"],
    queryFn: () => getPatientAppointments(patientId),
    enabled,
  });
}

export function usePatientXrays(patientId: number, enabled = true) {
  return useQuery({
    queryKey: ["patient", patientId, "xrays"],
    queryFn: () => getPatientXrays(patientId),
    enabled,
  });
}

export function usePatientAiResults(patientId: number, enabled = true) {
  return useQuery({
    queryKey: ["patient", patientId, "ai-results"],
    queryFn: () => getPatientAiResults(patientId),
    enabled,
  });
}
