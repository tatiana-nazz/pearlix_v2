import { fireEvent, render, screen } from "@testing-library/react";
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

  it("keeps original and AI overlay in one transformed geometry", () => {
    const { container } = render(<ProtectedXrayViewer originalEndpoint="/original/" overlayEndpoint="/overlay/" overlayAvailable overlayVisible originalLabel="Protected original image" originalAlt="Dental X-ray" />);
    const layer = container.querySelector(".protected-xray-media");
    expect(layer?.querySelectorAll("img")).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: "Zoom in" }));
    expect(layer).toHaveAttribute("data-scale", "1.25");
    expect(layer?.querySelectorAll("img")).toHaveLength(2);
  });

  it("provides bounded zoom, fit, reset, and enlarged controls", () => {
    const { container } = render(<ProtectedXrayViewer originalEndpoint="/original/" overlayEndpoint="/overlay/" overlayAvailable originalLabel="Protected original image" originalAlt="Dental X-ray" />);
    const layer = container.querySelector(".protected-xray-media");
    fireEvent.click(screen.getByRole("button", { name: "Zoom in" }));
    expect(layer).toHaveAttribute("data-scale", "1.25");
    fireEvent.click(screen.getByRole("button", { name: "Fit to view" }));
    expect(layer).toHaveAttribute("data-scale", "1.00");
    fireEvent.click(screen.getByRole("button", { name: "Fullscreen" }));
    expect(screen.getByRole("dialog", { name: "Protected original image" })).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "AI overlay: Off" })).toBeVisible();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: "Protected original image" })).not.toBeInTheDocument();
  });

  it("shows a disabled, explained overlay control when no overlay exists", () => {
    render(<ProtectedXrayViewer originalEndpoint="/original/" originalLabel="Protected original image" originalAlt="Dental X-ray" />);
    fireEvent.click(screen.getByRole("button", { name: "Fullscreen" }));
    const toggle = screen.getByRole("switch", { name: "AI overlay: Off" });
    expect(toggle).toBeDisabled();
    expect(toggle).toHaveAttribute("title", "No AI overlay is available for this X-ray.");
  });
});
