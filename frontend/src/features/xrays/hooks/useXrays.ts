import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";

import { toApiClientError } from "../../../api/errors";
import { patientsApi } from "../../../api/endpoints/patients";
import { visitsApi } from "../../../api/endpoints/visits";
import { xraysApi } from "../../../api/endpoints/xrays";
import type { AIResult } from "../../../types/ai";
import type { ExternalAttachPayload, XrayUploadPayload } from "../../../types/xrays";
import { xrayUploadFormData } from "../utils/xrayValidation";

export const AI_RESULT_POLL_INTERVAL_MS = 2_000;

export function aiResultRefetchInterval(result?: Pick<AIResult, "status">): number | false {
  return result?.status === "PENDING" || result?.status === "PROCESSING"
    ? AI_RESULT_POLL_INTERVAL_MS
    : false;
}

export function useXrays(query?: Record<string, string | number | undefined>) {
  return useQuery({ queryKey: ["xrays", query], queryFn: () => xraysApi.list(query) });
}

export function useXray(xrayId: number) {
  return useQuery({ queryKey: ["xray", xrayId], queryFn: () => xraysApi.detail(xrayId), enabled: xrayId > 0 });
}

export function useXrayAiResult(xrayId: number, enabled: boolean) {
  return useQuery({
    queryKey: ["xray-ai-result", xrayId],
    queryFn: () => xraysApi.aiResult(xrayId),
    enabled,
    refetchInterval: (query) => aiResultRefetchInterval(query.state.data),
  });
}

export function useXrayAiResults(xrayIds: number[], pollingExcludedId?: number) {
  return useQueries({
    queries: xrayIds.map((xrayId) => ({
      queryKey: ["xray-ai-result", xrayId],
      queryFn: () => xraysApi.aiResult(xrayId),
      refetchInterval: (query: { state: { data?: AIResult } }) => (
        xrayId === pollingExcludedId ? false : aiResultRefetchInterval(query.state.data)
      ),
    })),
  });
}

function invalidateSavedXrayContext(queryClient: ReturnType<typeof useQueryClient>, patientId?: number, visitId?: number | null) {
  void queryClient.invalidateQueries({ queryKey: ["xrays"] });
  if (patientId) {
    void queryClient.invalidateQueries({ queryKey: ["patient", patientId, "xrays"] });
    void queryClient.invalidateQueries({ queryKey: ["patient", patientId, "ai-results"] });
  }
  if (visitId) void queryClient.invalidateQueries({ queryKey: ["visit", visitId] });
}

export function usePatientXrayUpload(patientId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: XrayUploadPayload) => patientsApi.uploadXray(patientId, xrayUploadFormData(payload)),
    onSuccess: (xray) => invalidateSavedXrayContext(queryClient, xray.patient.id, xray.visit?.id),
  });
}

export function useVisitXrayUpload(visitId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: XrayUploadPayload) => visitsApi.uploadXray(visitId, xrayUploadFormData(payload)),
    onSuccess: (xray) => invalidateSavedXrayContext(queryClient, xray.patient.id, xray.visit?.id),
  });
}

export function useRunSavedXrayAi(xrayId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => xraysApi.runAi(xrayId),
    onSuccess: (result) => {
      queryClient.setQueryData(["xray-ai-result", xrayId], result);
      void queryClient.invalidateQueries({ queryKey: ["xray", xrayId] });
      if (result.xray_attachment?.patient_id) void queryClient.invalidateQueries({ queryKey: ["patient", result.xray_attachment.patient_id, "ai-results"] });
      void queryClient.invalidateQueries({ queryKey: ["xrays"] });
    },
    onError: (error) => {
      if (toApiClientError(error).code !== "AI_ANALYSIS_IN_PROGRESS") return;
      void queryClient.fetchQuery({
        queryKey: ["xray-ai-result", xrayId],
        queryFn: () => xraysApi.aiResult(xrayId),
      }).catch(() => undefined);
      void queryClient.invalidateQueries({ queryKey: ["xray", xrayId] });
    },
  });
}

export function useExternalXrays(query?: Record<string, string | number | undefined>) {
  return useQuery({ queryKey: ["external-xrays", query], queryFn: () => xraysApi.externalList(query) });
}

export function useExternalXray(caseId: number) {
  return useQuery({ queryKey: ["external-xray", caseId], queryFn: () => xraysApi.externalDetail(caseId), enabled: caseId > 0 });
}

export function useExternalAiResult(caseId: number, enabled: boolean) {
  return useQuery({
    queryKey: ["external-xray-ai-result", caseId],
    queryFn: () => xraysApi.externalAiResult(caseId),
    enabled,
    refetchInterval: (query) => aiResultRefetchInterval(query.state.data),
  });
}

export function useExternalXrayMutations() {
  const queryClient = useQueryClient();
  const invalidate = (caseId?: number) => {
    void queryClient.invalidateQueries({ queryKey: ["external-xrays"] });
    if (caseId) void queryClient.invalidateQueries({ queryKey: ["external-xray", caseId] });
  };
  return {
    upload: useMutation({ mutationFn: (payload: XrayUploadPayload) => xraysApi.createExternal(xrayUploadFormData(payload)), onSuccess: () => invalidate() }),
    runAi: useMutation({
      mutationFn: (caseId: number) => xraysApi.runExternalAi(caseId),
      onSuccess: (result, caseId) => {
        queryClient.setQueryData(["external-xray-ai-result", caseId], result);
        invalidate(caseId);
      },
      onError: (error, caseId) => {
        if (toApiClientError(error).code !== "AI_ANALYSIS_IN_PROGRESS") return;
        void queryClient.fetchQuery({
          queryKey: ["external-xray-ai-result", caseId],
          queryFn: () => xraysApi.externalAiResult(caseId),
        }).catch(() => undefined);
        invalidate(caseId);
      },
    }),
    discard: useMutation({ mutationFn: (caseId: number) => xraysApi.discardExternal(caseId), onSuccess: (_, caseId) => invalidate(caseId) }),
    attach: useMutation({
      mutationFn: ({ caseId, payload }: { caseId: number; payload: ExternalAttachPayload }) => xraysApi.attachExternalToPatient(caseId, payload),
      onSuccess: (external, variables) => {
        invalidate(variables.caseId);
        if (external.attached_patient) invalidateSavedXrayContext(queryClient, external.attached_patient.id, external.attached_visit?.id);
      },
    }),
  };
}
