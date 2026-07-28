import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { visitsApi } from "../../../api/endpoints/visits";
import { ApiClientError, toApiClientError } from "../../../api/errors";
import { useAuthStore } from "../../../auth/authStore";
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

export function isNoActiveVisitError(error: unknown): boolean {
  return error instanceof ApiClientError && error.status === 404 && error.code === "NO_ACTIVE_VISIT";
}

export function useActiveVisit() {
  const userId = useAuthStore((state) => state.user?.id);
  const role = useAuthStore((state) => state.role);
  return useQuery({
    queryKey: ["active-visit", userId],
    queryFn: async () => {
      try {
        return await visitsApi.active();
      } catch (error) {
        const apiError = toApiClientError(error);
        // The dedicated active endpoint uses 404 exclusively for the documented empty state.
        if (isNoActiveVisitError(apiError) || apiError.status === 404) return null;
        throw apiError;
      }
    },
    enabled: role === "DOCTOR" && Boolean(userId),
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
