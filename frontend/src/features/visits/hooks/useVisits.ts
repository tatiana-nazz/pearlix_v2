import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { visitsApi } from "../../../api/endpoints/visits";
import { ApiClientError } from "../../../api/errors";
import type { ClinicalNotesPayload, VisitDetail } from "../../../types/visits";

export function visitKey(visitId: number) {
  return ["visit", visitId] as const;
}

function invalidateVisitContext(queryClient: ReturnType<typeof useQueryClient>, visit: VisitDetail) {
  queryClient.setQueryData(visitKey(visit.id), visit);
  void queryClient.invalidateQueries({ queryKey: ["active-visit"] });
  void queryClient.invalidateQueries({ queryKey: ["appointments"] });
  void queryClient.invalidateQueries({ queryKey: ["patient", visit.patient.id, "visits"] });
  void queryClient.invalidateQueries({ queryKey: ["patient", visit.patient.id] });
  void queryClient.invalidateQueries({ queryKey: ["dashboard", "doctor"] });
  void queryClient.invalidateQueries({ queryKey: ["billing-handoffs"] });
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
        if (error instanceof ApiClientError && error.code === "NOT_FOUND") return null;
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
    mutationFn: () => visitsApi.complete(visitId),
    onSuccess: (visit) => invalidateVisitContext(queryClient, visit),
  });
}
