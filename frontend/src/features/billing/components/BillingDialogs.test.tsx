import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useAuthStore } from "../../../auth/authStore";
import { PaymentDialog } from "./BillingDialogs";

function setLanguage(language_preference: "EN" | "AR") {
  useAuthStore.setState({ user: { id: 1, full_name: "Staff User", email: "staff@example.test", role: "STAFF", is_active: true, must_change_password: false, password_changed_at: null, theme_preference: "LIGHT", language_preference } });
}

describe("PaymentDialog", () => {
  beforeEach(() => setLanguage("EN"));

  it("validates positive amounts and only calls the success callback after valid submission", () => {
    const onSubmit = vi.fn();
    render(<PaymentDialog currency="USD" remainingAmount="50.00" pending={false} onCancel={vi.fn()} onSubmit={onSubmit} />);
    fireEvent.change(screen.getByRole("textbox", { name: "Amount" }), { target: { value: "0" } });
    fireEvent.click(screen.getByRole("button", { name: "Record payment" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Enter a valid positive amount.");
    fireEvent.change(screen.getByRole("textbox", { name: "Amount" }), { target: { value: "25.00" } });
    fireEvent.click(screen.getByRole("button", { name: "Record payment" }));
    expect(onSubmit).toHaveBeenCalledWith({ amount: "25.00", currency: "USD", notes: "" });
  });

  it("uses Arabic labels for the critical payment controls", () => {
    setLanguage("AR");
    render(<PaymentDialog currency="SYP" remainingAmount="100.00" pending={false} onCancel={vi.fn()} onSubmit={vi.fn()} />);
    expect(screen.getByRole("dialog", { name: "تسجيل دفعة" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "تسجيل الدفعة" })).toBeInTheDocument();
  });
});
