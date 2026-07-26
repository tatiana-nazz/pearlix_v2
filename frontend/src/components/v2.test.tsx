import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { ActionMenu, ActionMenuItem, ActionMenuSeparator, Button, ClickableRow, Combobox, DataTableShell, Field, Modal, PreviewList, SelectField, StatePanel, StatusBadge, Tabs } from "./v2";

describe("Phase 14C shared primitives", () => {
  it("keeps buttons identifiable while loading and disables duplicate submission", () => {
    render(<Button loading>Save record</Button>);
    expect(screen.getByRole("button", { name: "Save record" })).toBeDisabled();
    expect(screen.getByRole("button")).toHaveAttribute("aria-busy", "true");
  });

  it("renders semantic status text, an icon, and a safe unknown fallback", () => {
    const { rerender } = render(<StatusBadge status="PAID" />);
    expect(screen.getByLabelText("Status: PAID")).toHaveTextContent("PAID");
    expect(screen.getByLabelText("Status: PAID").querySelector("svg")).toBeTruthy();
    rerender(<StatusBadge status="FUTURE_STATUS" />);
    expect(screen.getByLabelText("Status: FUTURE STATUS")).toBeInTheDocument();
  });

  it("keeps machine status semantics when a localized label is supplied", () => {
    render(<StatusBadge status="NEEDS_RESCHEDULE" label="بحاجة إلى إعادة جدولة" />);
    const badge = screen.getByLabelText("Status: بحاجة إلى إعادة جدولة");
    expect(badge).toHaveAttribute("data-status", "NEEDS_RESCHEDULE");
    expect(badge).toHaveClass("v2-status", "warning");
    expect(badge).toHaveTextContent("بحاجة إلى إعادة جدولة");
  });

  it("supports tab selection and arrow-key navigation", () => {
    function Example() { const [selected, setSelected] = useState("one"); return <Tabs selected={selected} onSelect={setSelected} tabs={[{ id:"one", label:"One" }, { id:"two", label:"Two" }]} />; }
    render(<Example />);
    fireEvent.keyDown(screen.getByRole("tab", { name:"One" }), { key:"ArrowRight" });
    expect(screen.getByRole("tab", { name:"Two" })).toHaveAttribute("aria-selected", "true");
  });

  it("opens a row with click/Enter/Space but not an inner action", () => {
    const open = vi.fn();
    render(<table><tbody><ClickableRow onOpen={open}><td>Patient</td><td><button type="button">Edit</button></td></ClickableRow></tbody></table>);
    const row = screen.getByText("Patient").closest("tr")!;
    fireEvent.click(row); fireEvent.keyDown(row, { key:"Enter" }); fireEvent.keyDown(row, { key:" " });
    fireEvent.click(screen.getByRole("button", { name:"Edit" }));
    expect(open).toHaveBeenCalledTimes(3);
  });

  it("keeps overflow actions keyboard accessible, dismissible, and focused on their trigger", async () => {
    render(<ActionMenu label="More actions"><ActionMenuItem onSelect={() => undefined}>Edit</ActionMenuItem><ActionMenuSeparator /><ActionMenuItem danger onSelect={() => undefined}>Archive</ActionMenuItem></ActionMenu>);
    const trigger = screen.getByRole("button", { name: "More actions" });
    trigger.focus(); fireEvent.keyDown(trigger, { key: "ArrowDown" });
    expect(await screen.findByRole("menu", { name: "More actions" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Edit" })).toHaveFocus();
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument());
    expect(trigger).toHaveFocus();
    fireEvent.click(trigger); fireEvent.pointerDown(document.body);
    await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument());
  });

  it("limits previews then expands and collapses without hiding View all", () => {
    render(<PreviewList items={[1,2,3]} initialCount={2} renderItem={(item) => <li key={item}>{item}</li>} viewAll={<a href="/all">View all</a>} />);
    expect(screen.queryByText("3")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name:/Show more/ }));
    expect(screen.getByText("3")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name:"Show less" }));
    expect(screen.getByRole("link", { name:"View all" })).toBeInTheDocument();
  });

  it("exposes populated and stateful table, form, combobox, and state contracts", () => {
    function Example() { const [value, setValue] = useState(""); return <><DataTableShell title="Patients" count={1}><table><tbody><tr><td>One</td></tr></tbody></table></DataTableShell><DataTableShell title="Empty" state={<StatePanel state="empty" title="No patients" />}><span /></DataTableShell><Field label="Name" error="Required" /><SelectField label="Role" value="STAFF" onChange={() => undefined} error="Choose"><option value="STAFF">Staff</option></SelectField><Combobox label="Doctor" value={value} onChange={setValue} options={[{ value:"1", label:"Dr Noor" }, { value:"2", label:"Dr Sam" }]} /></>; }
    render(<Example />);
    expect(screen.getByText("Patients (1)")).toBeInTheDocument();
    expect(screen.getByText("No patients")).toBeInTheDocument();
    expect(screen.getByLabelText("Name")).toHaveAttribute("aria-describedby");
    expect(screen.getByLabelText("Role")).toHaveValue("STAFF");
    const combo = screen.getByRole("combobox", { name:"Doctor" });
    fireEvent.focus(combo); fireEvent.keyDown(combo, { key:"ArrowDown" }); fireEvent.keyDown(combo, { key:"Enter" });
    expect(combo).toHaveValue("1");
    fireEvent.keyDown(combo, { key:"Escape" }); expect(combo).toHaveAttribute("aria-expanded", "false");
  });

  it("closes overlays safely, traps focus, returns focus, and protects dirty/pending work", async () => {
    function Example({ dirty = false, pending = false }: { dirty?:boolean; pending?:boolean }) { const [open, setOpen] = useState(false); return <><button onClick={() => setOpen(true)}>Open</button><Modal open={open} title="Edit" dirty={dirty} pending={pending} onClose={() => setOpen(false)}><button>First</button><button>Last</button></Modal></>; }
    const { rerender } = render(<Example />);
    const opener = screen.getByRole("button", { name:"Open" }); opener.focus(); fireEvent.click(opener);
    expect(screen.getByRole("dialog")).toBeInTheDocument(); fireEvent.keyDown(document, { key:"Escape" }); expect(screen.queryByRole("dialog")).not.toBeInTheDocument(); await waitFor(() => expect(opener).toHaveFocus());
    rerender(<Example dirty />); fireEvent.click(screen.getByRole("button", { name:"Open" })); fireEvent.click(screen.getByRole("button", { name:"Close" })); expect(screen.getByRole("alertdialog")).toBeInTheDocument(); fireEvent.click(screen.getByRole("button", { name:"Keep editing" })); expect(screen.getByRole("dialog")).toBeInTheDocument(); fireEvent.click(screen.getByRole("button", { name:"Close" })); fireEvent.click(screen.getByRole("button", { name:"Discard" })); expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    rerender(<Example pending />); fireEvent.click(screen.getByRole("button", { name:"Open" })); fireEvent.keyDown(document, { key:"Escape" }); expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});
