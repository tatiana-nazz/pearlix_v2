import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

type MediaState = { url: string | null; contentType: string | null; isLoading: boolean; error: unknown; retry: ReturnType<typeof vi.fn> };
const media = vi.hoisted((): { current: MediaState } => ({ current: { url: "blob:protected", contentType: "image/png", isLoading: false, error: null, retry: vi.fn() } }));
vi.mock("../hooks/useProtectedMedia", () => ({ useProtectedMedia: () => media.current }));

import { ProtectedXrayImage } from "./ProtectedXrayImage";

describe("ProtectedXrayImage", () => {
  afterEach(() => { media.current = { url: "blob:protected", contentType: "image/png", isLoading: false, error: null, retry: vi.fn() }; });

  it("never uses a storage URL and retries both authenticated-media failures and decode failures", async () => {
    media.current = { url: null, contentType: null, isLoading: false, error: new Error("403"), retry: vi.fn() };
    const view = render(<ProtectedXrayImage endpoint="/xrays/4/file/" label="Original X-ray" alt="Protected X-ray" />);
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole("button", { name: "Retry" }));
    expect(media.current.retry).toHaveBeenCalledOnce();
    media.current = { url: "blob:protected", contentType: "image/png", isLoading: false, error: null, retry: vi.fn() };
    view.rerender(<ProtectedXrayImage endpoint="/xrays/4/file/" label="Original X-ray" alt="Protected X-ray" />);
    const image = screen.getByRole("img", { name: "Protected X-ray" });
    expect(image).toHaveAttribute("src", "blob:protected");
    fireEvent.error(image);
    await userEvent.setup().click(screen.getByRole("button", { name: "Retry" }));
    expect(media.current.retry).toHaveBeenCalledOnce();
  });
});
