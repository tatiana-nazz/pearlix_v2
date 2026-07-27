import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { visitsApi } from "../../../api/endpoints/visits";
import { ApiClientError } from "../../../api/errors";
import type { ClinicalNotesPayload, VisitDetail } from "../../../types/visits";

export function visitKey(visitId: number) {
  return ["visit", visitId] as const;
}

function invalidateVisitContext(queryClient: ReturnType<typeof useQueryClient>, visit: VisitDetail, refetchActive = true) {
  queryClient.setQueryData(visitKey(visit.id), visit);
  void queryClient.invalidateQueries({ queryKey: ["active-visit"], refetchType: refetchActive ? "active" : "none" });
  void queryClient.invalidateQueries({ queryKey: ["appointments"] });
  void queryClient.invalidateQueries({ queryKey: ["patient", visit.patient.id, "visits"] });
  void queryClient.invalidateQueries({ queryKey: ["dashboard", "doctor"] });
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
    onSuccess: (result) => {
      invalidateVisitContext(queryClient, result.visit, false);
      void queryClient.invalidateQueries({ queryKey: ["billing-handoffs"] });
      void queryClient.invalidateQueries({ queryKey: ["patient", result.visit.patient.id, "billing"] });
    },
  });
}
