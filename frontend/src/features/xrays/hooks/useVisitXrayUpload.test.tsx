import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { PropsWithChildren } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { XrayAttachment } from "../../../types/xrays";
import { useVisitXrayUpload } from "./useXrays";

const visits = vi.hoisted(() => ({
  uploadXray: vi.fn(),
}));

vi.mock("../../../api/endpoints/visits", () => ({ visitsApi: visits }));

function setup() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: PropsWithChildren) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, wrapper };
}

const uploadedXray = {
  id: 3,
  patient: { id: 44, full_name: "Ada Lovelace" },
  visit: { id: 91, status: "ACTIVE", started_at: "2026-08-17T09:01:00Z", completed_at: null },
  uploaded_by: { id: 7, full_name: "Doctor One" },
  source: "ACTIVE_VISIT",
  title: "New upload",
  notes: "",
  stored_file_name: "stored-new.png",
  original_file_name: "new-xray.png",
  content_type: "image/png",
  size_bytes: 1024,
  file_endpoint: "/api/xrays/3/file/",
  ai_result_endpoint: "/api/xrays/3/ai-result/",
  ai_overlay_endpoint: "/api/xrays/3/ai-overlay/",
  has_ai_result: false,
  created_at: "2026-08-17T09:02:00Z",
  updated_at: "2026-08-17T09:02:00Z",
} as XrayAttachment;

describe("useVisitXrayUpload", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    visits.uploadXray.mockResolvedValue(uploadedXray);
  });

  it("makes the newly uploaded X-ray detail available before the caller handles completion", async () => {
    const { client, wrapper } = setup();
    const { result } = renderHook(() => useVisitXrayUpload(91), { wrapper });
    const file = new File(["image"], "new-xray.png", { type: "image/png" });
    let cachedAtCompletion: XrayAttachment | undefined;

    await act(async () => {
      await result.current.mutateAsync({ file, title: "", notes: "" }).then(() => {
        cachedAtCompletion = client.getQueryData<XrayAttachment>(["xray", uploadedXray.id]);
      });
    });

    expect(cachedAtCompletion).toEqual(uploadedXray);
    expect(visits.uploadXray).toHaveBeenCalledWith(91, expect.any(FormData));
  });
});
