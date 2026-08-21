import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useAuthStore } from "../../../auth/authStore";
import { ProtectedXrayViewer } from "./ProtectedXrayViewer";

const media = vi.hoisted(() => vi.fn());
vi.mock("../hooks/useProtectedMedia", () => ({ useProtectedMedia: (endpoint?: string | null) => media(endpoint) }));

const ready = (url: string | null) => ({ url, contentType: "image/png", isLoading: false, error: null, retry: vi.fn() });

describe("ProtectedXrayViewer", () => {
  beforeEach(() => {
    useAuthStore.setState({ user: { id: 7, full_name: "Dr Noor", email: "doctor@example.test", role: "DOCTOR", is_active: true, must_change_password: false, password_changed_at: null, theme_preference: "LIGHT", language_preference: "EN" } });
    media.mockReset();
    media.mockImplementation((endpoint?: string | null) => ready(endpoint ? `blob:${endpoint}` : null));
  });

  it("layers the protected overlay on the original canvas and exposes an accessible toggle", () => {
    const { container } = render(<ProtectedXrayViewer originalEndpoint="/original/" overlayEndpoint="/overlay/" overlayAvailable originalLabel="Protected original image" originalAlt="Dental X-ray" />);
    const button = screen.getByRole("button", { name: "Show AI Overlay" });
    expect(button).toHaveAttribute("aria-pressed", "false");
    expect(container.querySelectorAll(".protected-xray-canvas")).toHaveLength(1);
    expect(container.querySelector(".protected-xray-original")).toBeInTheDocument();
    expect(container.querySelector(".protected-xray-overlay")).not.toBeInTheDocument();
    const legend = screen.getByLabelText("Overlay colors");
    expect(legend).toHaveTextContent("Q1 upper rightQ2 upper leftQ3 lower leftQ4 lower right");
    expect(legend).not.toHaveTextContent("Review");

    fireEvent.click(button);
    expect(screen.getByRole("button", { name: "Hide AI Overlay" })).toHaveAttribute("aria-pressed", "true");
    const canvas = container.querySelector(".protected-xray-canvas")!;
    expect(canvas.querySelector(".protected-xray-original")).toBeInTheDocument();
    expect(canvas.querySelector(".protected-xray-overlay")).toBeInTheDocument();
    expect(container.querySelectorAll("figure")).toHaveLength(1);

    fireEvent.click(screen.getByRole("button", { name: "Hide AI Overlay" }));
    expect(screen.getByRole("button", { name: "Show AI Overlay" })).toHaveAttribute("aria-pressed", "false");
  });

  it("keeps the original visible and reports a recoverable overlay failure", async () => {
    media.mockImplementation((endpoint?: string | null) => endpoint === "/overlay/"
      ? { ...ready(null), error: new Error("denied") }
      : ready(endpoint ? `blob:${endpoint}` : null));
    const { container } = render(<ProtectedXrayViewer originalEndpoint="/original/" overlayEndpoint="/overlay/" overlayAvailable originalLabel="Protected original image" originalAlt="Dental X-ray" />);
    fireEvent.click(screen.getByRole("button", { name: "Show AI Overlay" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("original image remains available"));
    expect(container.querySelector(".protected-xray-original")).toBeInTheDocument();
    expect(container.querySelector(".protected-xray-overlay")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Show AI Overlay" })).toHaveAttribute("aria-pressed", "false");
  });

  it("localizes the overlay control in Arabic", () => {
    useAuthStore.setState((state) => ({ user: state.user ? { ...state.user, language_preference: "AR" } : null }));
    render(<ProtectedXrayViewer originalEndpoint="/original/" overlayEndpoint="/overlay/" overlayAvailable originalLabel="الصورة الأصلية" originalAlt="أشعة أسنان" />);
    expect(screen.getByRole("button", { name: "إظهار طبقة الذكاء الاصطناعي" })).toHaveAttribute("aria-pressed", "false");
  });

  it("shares bounded zoom transforms and provides reset, fit, and enlarged fallback controls", () => {
    const { container } = render(<ProtectedXrayViewer originalEndpoint="/original/" overlayEndpoint="/overlay/" overlayAvailable originalLabel="Protected original image" originalAlt="Dental X-ray" />);
    const mediaLayer = container.querySelector(".protected-xray-media");
    expect(mediaLayer).toHaveAttribute("data-scale", "1.00");
    fireEvent.click(screen.getByRole("button", { name: "Show AI Overlay" }));
    fireEvent.click(screen.getByRole("button", { name: "Zoom In" }));
    expect(mediaLayer).toHaveAttribute("data-scale", "1.25");
    expect(mediaLayer?.querySelectorAll("img")).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: "Zoom Out" }));
    expect(mediaLayer).toHaveAttribute("data-scale", "1.00");
    fireEvent.click(screen.getByRole("button", { name: "Zoom In" }));
    fireEvent.click(screen.getByRole("button", { name: "Fit to View" }));
    expect(mediaLayer).toHaveAttribute("data-scale", "1.00");
    fireEvent.click(screen.getByRole("button", { name: "Reset" }));
    expect(container.querySelector(".protected-xray-overlay")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Fullscreen" }));
    expect(screen.getByRole("dialog", { name: "Protected original image" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Exit Fullscreen" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: "Protected original image" })).not.toBeInTheDocument();
  });

  it("uses a width-scaled scrollable surface so zoom preserves the panoramic aspect ratio", () => {
    const { container } = render(<ProtectedXrayViewer originalEndpoint="/original/" overlayEndpoint="/overlay/" overlayAvailable originalLabel="Protected original image" originalAlt="Dental X-ray" />);
    const zoom = screen.getByRole("button", { name: "Zoom In" });
    for (let step = 0; step < 8; step += 1) fireEvent.click(zoom);
    const mediaLayer = container.querySelector<HTMLElement>(".protected-xray-media")!;
    expect(mediaLayer).toHaveAttribute("data-scale", "3.00");
    expect(mediaLayer.style.inlineSize).toBe("300%");
    expect(mediaLayer.style.blockSize).toBe("");
    expect(screen.getByTestId("xray-pan-viewport")).toHaveClass("protected-xray-canvas");
  });

  it("keeps an overlay switch usable without exiting the enlarged viewer", () => {
    const { container } = render(<ProtectedXrayViewer originalEndpoint="/original/" overlayEndpoint="/overlay/" overlayAvailable originalLabel="Protected original image" originalAlt="Dental X-ray" showOverlayControl={false} />);
    expect(screen.queryByRole("switch", { name: "AI Overlay: Off" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Fullscreen" }));
    const dialog = screen.getByRole("dialog", { name: "Protected original image" });
    const fullscreenSwitch = screen.getByRole("switch", { name: "AI Overlay: Off" });
    expect(fullscreenSwitch).toBeVisible();
    expect(fullscreenSwitch).toHaveAttribute("aria-checked", "false");
    fireEvent.click(fullscreenSwitch);
    expect(dialog).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "AI Overlay: On" })).toHaveAttribute("aria-checked", "true");
    expect(container.querySelector(".protected-xray-original")).toBeInTheDocument();
    expect(container.querySelector(".protected-xray-overlay")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("switch", { name: "AI Overlay: On" }));
    expect(dialog).toBeInTheDocument();
    expect(container.querySelector(".protected-xray-overlay")).not.toBeInTheDocument();
  });

  it("shows a disabled fullscreen switch and explanation when no overlay exists", () => {
    render(<ProtectedXrayViewer originalEndpoint="/original/" originalLabel="Protected original image" originalAlt="Dental X-ray" showOverlayControl={false} />);
    fireEvent.click(screen.getByRole("button", { name: "Fullscreen" }));
    expect(screen.getByRole("switch", { name: "AI Overlay: Off" })).toBeDisabled();
    expect(screen.getByText("No AI overlay is available for this X-ray.")).toBeVisible();
  });
});
