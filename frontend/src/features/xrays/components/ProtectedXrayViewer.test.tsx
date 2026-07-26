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
    const button = screen.getByRole("button", { name: "Show AI overlay" });
    expect(button).toHaveAttribute("aria-pressed", "false");
    expect(container.querySelectorAll(".protected-xray-canvas")).toHaveLength(1);
    expect(container.querySelector(".protected-xray-original")).toBeInTheDocument();
    expect(container.querySelector(".protected-xray-overlay")).not.toBeInTheDocument();

    fireEvent.click(button);
    expect(screen.getByRole("button", { name: "Hide AI overlay" })).toHaveAttribute("aria-pressed", "true");
    const canvas = container.querySelector(".protected-xray-canvas")!;
    expect(canvas.querySelector(".protected-xray-original")).toBeInTheDocument();
    expect(canvas.querySelector(".protected-xray-overlay")).toBeInTheDocument();
    expect(container.querySelectorAll("figure")).toHaveLength(1);

    fireEvent.click(screen.getByRole("button", { name: "Hide AI overlay" }));
    expect(screen.getByRole("button", { name: "Show AI overlay" })).toHaveAttribute("aria-pressed", "false");
  });

  it("keeps the original visible and reports a recoverable overlay failure", async () => {
    media.mockImplementation((endpoint?: string | null) => endpoint === "/overlay/"
      ? { ...ready(null), error: new Error("denied") }
      : ready(endpoint ? `blob:${endpoint}` : null));
    const { container } = render(<ProtectedXrayViewer originalEndpoint="/original/" overlayEndpoint="/overlay/" overlayAvailable originalLabel="Protected original image" originalAlt="Dental X-ray" />);
    fireEvent.click(screen.getByRole("button", { name: "Show AI overlay" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("original image remains available"));
    expect(container.querySelector(".protected-xray-original")).toBeInTheDocument();
    expect(container.querySelector(".protected-xray-overlay")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Show AI overlay" })).toHaveAttribute("aria-pressed", "false");
  });

  it("localizes the overlay control in Arabic", () => {
    useAuthStore.setState((state) => ({ user: state.user ? { ...state.user, language_preference: "AR" } : null }));
    render(<ProtectedXrayViewer originalEndpoint="/original/" overlayEndpoint="/overlay/" overlayAvailable originalLabel="الصورة الأصلية" originalAlt="أشعة أسنان" />);
    expect(screen.getByRole("button", { name: "إظهار طبقة الذكاء الاصطناعي" })).toHaveAttribute("aria-pressed", "false");
  });
});
