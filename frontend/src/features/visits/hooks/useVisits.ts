import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { visitsApi } from "../../../api/endpoints/visits";
import { ApiClientError } from "../../../api/errors";
import type { ClinicalNotesPayload, VisitDetail } from "../../../types/visits";
import { invalidateBillingQueries } from "../../billing/hooks/billingCache";

export function visitKey(visitId: number) {
  return ["visit", visitId] as const;
}

async function invalidateVisitContext(queryClient: ReturnType<typeof useQueryClient>, visit: VisitDetail, refetchActive = true) {
  queryClient.setQueryData(visitKey(visit.id), visit);
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ["active-visit"], refetchType: refetchActive ? "active" : "none" }),
    queryClient.invalidateQueries({ queryKey: ["appointments"] }),
    queryClient.invalidateQueries({ queryKey: ["patient", visit.patient.id, "visits"] }),
    queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
  ]);
}

export function useVisit(visitId: number) {
  return useQuery({
    queryKey: visitKey(visitId),
    queryFn: () => visitsApi.detail(visitId),
    enabled: Number.isFinite(visitId) && visitId > 0,
  });
}

export function useActiveVisit() {
  return useQuery({
    queryKey: ["active-visit"],
    queryFn: async () => {
      try {
        return await visitsApi.active();
      } catch (error) {
        if (error instanceof ApiClientError && (error.code === "NOT_FOUND" || error.status === 404)) return null;
        throw error;
      }
    },
  });
}

export function useUpdateClinicalNotes(visitId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: ClinicalNotesPayload) => visitsApi.updateClinicalNotes(visitId, payload),
    onSuccess: (visit) => invalidateVisitContext(queryClient, visit),
  });
}

export function useCompleteVisit(visitId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: Parameters<typeof visitsApi.complete>[1]) => visitsApi.complete(visitId, payload),
    onSuccess: async (result) => {
      await Promise.all([
        invalidateVisitContext(queryClient, result.visit, false),
        invalidateBillingQueries(queryClient, {
          handoffId: result.created_handoff.id,
          patientId: result.visit.patient.id,
          visitId: result.visit.id,
          appointmentId: result.visit.appointment.id,
          refetchActiveVisit: false,
        }),
      ]);
    },
  });
}
