import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { XrayUploadDialog } from "./XrayUploadDialog";

describe("XrayUploadDialog production integration", () => {
  afterEach(() => vi.restoreAllMocks());

  it("validates files and submits one supported multipart-ready payload while preserving errors", async () => {
    Object.defineProperty(URL, "createObjectURL", { configurable: true, value: vi.fn(() => "blob:preview") });
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: vi.fn() });
    const submit = vi.fn();
    render(<XrayUploadDialog title="Upload external X-ray" isSubmitting={false} onCancel={vi.fn()} onSubmit={submit} />);
    const input = screen.getByLabelText("X-ray image file");
    fireEvent.change(input, { target: { files: [new File(["pdf"], "xray.pdf", { type: "application/pdf" })] } });
    expect(screen.getByRole("alert")).toHaveTextContent("Supported formats");
    const user = userEvent.setup();
    const valid = new File(["image"], "xray.png", { type: "image/png" });
    fireEvent.change(input, { target: { files: [valid] } });
    await user.type(screen.getByRole("textbox", { name: "Title" }), "External image");
    await user.type(screen.getByRole("textbox", { name: "Notes" }), "Patient supplied");
    await user.click(screen.getByRole("button", { name: "Upload" }));
    expect(submit).toHaveBeenCalledTimes(1);
    expect(submit).toHaveBeenCalledWith({ file: valid, title: "External image", notes: "Patient supplied" });
  });

  it("blocks every close action while upload is pending", () => {
    const cancel = vi.fn();
    render(<XrayUploadDialog title="Upload external X-ray" isSubmitting onCancel={cancel} onSubmit={vi.fn()} />);
    fireEvent.keyDown(document, { key: "Escape" });
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(cancel).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Uploading" })).toBeDisabled();
  });
});
