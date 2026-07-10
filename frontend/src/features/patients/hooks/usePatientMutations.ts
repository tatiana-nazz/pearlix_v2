import { useMutation, useQueryClient } from "@tanstack/react-query";

import { archivePatient, createPatient, unarchivePatient, updatePatient } from "../../../api/endpoints/patients";
import type { CreatePatientPayload, PatientVersionPayload, UpdatePatientPayload } from "../../../types/patients";
import { patientKey } from "./usePatient";

function invalidatePatients(queryClient: ReturnType<typeof useQueryClient>, patientId?: number) {
  void queryClient.invalidateQueries({ queryKey: ["patients"] });
  if (patientId) void queryClient.invalidateQueries({ queryKey: patientKey(patientId) });
}

export function useCreatePatient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreatePatientPayload) => createPatient(payload),
    onSuccess: (patient) => invalidatePatients(queryClient, patient.id),
  });
}

export function useUpdatePatient(patientId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdatePatientPayload) => updatePatient(patientId, payload),
    onSuccess: (patient) => invalidatePatients(queryClient, patient.id),
  });
}

export function useArchivePatient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, version }: PatientVersionPayload & { id: number }) => archivePatient(id, { version }),
    onSuccess: (patient) => invalidatePatients(queryClient, patient.id),
  });
}

export function useUnarchivePatient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, version }: PatientVersionPayload & { id: number }) => unarchivePatient(id, { version }),
    onSuccess: (patient) => invalidatePatients(queryClient, patient.id),
  });
}
