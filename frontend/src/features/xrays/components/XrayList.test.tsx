import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";

import type { XrayAttachment } from "../../../types/xrays";
import { XrayList } from "./XrayList";

const xray: XrayAttachment = {
  id: 9, title: "Review image", notes: "", source: "ACTIVE_VISIT", original_file_name: "review.png", stored_file_name: "safe.png", content_type: "image/png", size_bytes: 1024,
  created_at: "2026-07-19T10:00:00Z", updated_at: "2026-07-19T10:00:00Z", file_endpoint: "/api/xrays/9/file/", ai_result_endpoint: "/api/xrays/9/ai-result/", ai_overlay_endpoint: "/api/xrays/9/ai-overlay/", has_ai_result: true,
  patient: { id: 5, full_name: "Patient Name", first_name: "Patient", last_name: "Name", gender: "Female", date_of_birth: null, age: 31, phone_number: "", email: "", national_id_or_passport: null, blood_group: "", is_archived: false, version: 1, created_at: "", updated_at: "" },
  visit: { id: 3, status: "ACTIVE", started_at: "2026-07-19T09:00:00Z", completed_at: null }, uploaded_by: { id: 2, full_name: "Dr. Lee", email: "lee@example.test", role: "DOCTOR", is_active: true, theme_preference: "LIGHT", language_preference: "EN" },
};

describe("XrayList gallery", () => {
  it("keeps protected-image data out of the gallery while exposing the selected-image route by keyboard and pointer", async () => {
    render(<MemoryRouter initialEntries={["/doctor/xrays"]}><Routes><Route path="/doctor/xrays" element={<XrayList role="DOCTOR" xrays={[xray]} />} /><Route path="/doctor/xrays/9" element={<p>detail</p>} /></Routes></MemoryRouter>);
    const card = screen.getByRole("listitem", { name: /open x-ray: review image/i });
    expect(card).toHaveTextContent("AI result available");
    expect(card).not.toHaveTextContent("safe.png");
    await userEvent.setup().click(card);
    expect(screen.getByText("detail")).toBeInTheDocument();
  });
});
