import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { RescheduleAppointmentPage } from "./RescheduleAppointmentPage";

let latestDirty = false;
const navigate = vi.fn(() => {
  if (latestDirty) throw new Error("navigation occurred while the unsaved-changes guard was active");
});
const mutateAsync = vi.fn().mockResolvedValue({});

vi.mock("react-router-dom", async (importOriginal) => {
  const original = await importOriginal<typeof import("react-router-dom")>();
  return { ...original, Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>, useNavigate: () => navigate, useParams: () => ({ appointmentId: "5" }) };
});
vi.mock("@tanstack/react-query", () => ({ useQuery: () => ({ data: { timezone: "Asia/Damascus" } }) }));
vi.mock("../../hooks/useUnsavedChanges", () => ({ useUnsavedChanges: (dirty: boolean) => { latestDirty = dirty; } }));
vi.mock("../../features/appointments/hooks/useAppointmentMutations", () => ({ useUpdateAppointment: () => ({ mutateAsync, isPending: false, error: null }) }));
vi.mock("../../features/appointments/hooks/useAppointments", () => ({ useAppointment: () => ({ data: { id: 5 }, isLoading: false, isError: false }) }));
vi.mock("../../features/appointments/hooks/useDoctors", () => ({ useDoctors: () => ({ data: [], isLoading: false, isError: false }) }));
vi.mock("../../features/appointments/components/RescheduleAppointmentPanel", () => ({
  RescheduleAppointmentPanel: ({ onDirtyChange, onSubmit }: { onDirtyChange: (dirty: boolean) => void; onSubmit: (payload: object) => Promise<void> }) => (
    <>
      <button type="button" onClick={() => onDirtyChange(true)}>Make dirty</button>
      <button type="button" onClick={() => void onSubmit({ version: 4 })}>Save reschedule</button>
    </>
  ),
}));

describe("RescheduleAppointmentPage", () => {
  beforeEach(() => {
    latestDirty = false;
    navigate.mockClear();
    mutateAsync.mockClear();
  });

  it("clears the unsaved-changes guard before navigating after a successful reschedule", async () => {
    render(<RescheduleAppointmentPage />);
    fireEvent.click(screen.getByRole("button", { name: "Make dirty" }));
    expect(latestDirty).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "Save reschedule" }));

    await waitFor(() => expect(navigate).toHaveBeenCalledWith("/staff/appointments/needs-reschedule"));
    expect(latestDirty).toBe(false);
  });
});
