import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getBlob: vi.fn() }));
vi.mock("../../../api/http", () => ({ api: { getBlob: mocks.getBlob } }));

import { useProtectedMedia } from "./useProtectedMedia";

function Probe({ endpoint }: { endpoint: string }) {
  const media = useProtectedMedia(endpoint);
  return <span>{media.url ?? "loading"}</span>;
}

describe("useProtectedMedia", () => {
  it("creates temporary object URLs and revokes replaced and unmounted URLs", async () => {
    mocks.getBlob.mockResolvedValueOnce(new Blob(["one"], { type: "image/png" })).mockResolvedValueOnce(new Blob(["two"], { type: "image/png" }));
    const createObjectURL = vi.fn().mockReturnValueOnce("blob:first").mockReturnValueOnce("blob:second");
    const revokeObjectURL = vi.fn();
    Object.defineProperty(URL, "createObjectURL", { configurable: true, value: createObjectURL });
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: revokeObjectURL });
    const view = render(<Probe endpoint="/xrays/1/file/" />);
    await waitFor(() => expect(screen.getByText("blob:first")).toBeInTheDocument());
    view.rerender(<Probe endpoint="/xrays/2/file/" />);
    await waitFor(() => expect(screen.getByText("blob:second")).toBeInTheDocument());
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:first");
    view.unmount();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:second");
  });
});
