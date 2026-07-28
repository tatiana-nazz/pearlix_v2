import { describe, expect, it, vi } from "vitest";

const post = vi.hoisted(() => vi.fn());
const postFormData = vi.hoisted(() => vi.fn());
const remove = vi.hoisted(() => vi.fn());
vi.mock("../http", () => ({ api: { post, postFormData, delete: remove } }));

import { xraysApi } from "./xrays";

describe("X-ray endpoint contracts", () => {
  it("sends external lifecycle mutations to their POST action endpoints and never DELETE", () => {
    const payload = { patient_id: 9, visit_id: 7, title: "Attached", notes: "Notes" };
    void xraysApi.discardExternal(5);
    void xraysApi.attachExternalToPatient(5, payload);
    void xraysApi.runExternalAi(5);
    expect(post).toHaveBeenNthCalledWith(1, "/external-xrays/5/discard/");
    expect(post).toHaveBeenNthCalledWith(2, "/external-xrays/5/attach-to-patient/", payload);
    expect(post).toHaveBeenNthCalledWith(3, "/external-xrays/5/run-ai/");
    expect(remove).not.toHaveBeenCalled();
    expect(postFormData).not.toHaveBeenCalled();
  });
});
