import { fireEvent, render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const blocker = vi.hoisted(() => ({
  current: { state: "unblocked", proceed: vi.fn(), reset: vi.fn() },
}));

vi.mock("react-router-dom", async () => {
  const React = await import("react");
  return {
    UNSAFE_DataRouterContext: React.createContext({}),
    useBlocker: () => blocker.current,
  };
});

import { useUnsavedChanges } from "./useUnsavedChanges";

function Editor({ dirty }: { dirty: boolean }) {
  useUnsavedChanges(dirty, "Discard draft?");
  return <p>Editor</p>;
}

describe("useUnsavedChanges", () => {
  beforeEach(() => {
    blocker.current = { state: "unblocked", proceed: vi.fn(), reset: vi.fn() };
    vi.restoreAllMocks();
  });

  it("blocks dirty route navigation and guards refresh/close only while dirty", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    blocker.current = { state: "blocked", proceed: vi.fn(), reset: vi.fn() };
    const { rerender } = render(<Editor dirty />);
    await waitFor(() => expect(blocker.current.reset).toHaveBeenCalledTimes(1));
    expect(confirm).toHaveBeenCalledWith("Discard draft?");
    const unload = new Event("beforeunload", { cancelable: true });
    fireEvent(window, unload);
    expect(unload.defaultPrevented).toBe(true);

    confirm.mockReturnValue(true);
    const next = { state: "blocked", proceed: vi.fn(), reset: vi.fn() };
    blocker.current = next;
    rerender(<Editor dirty />);
    await waitFor(() => expect(next.proceed).toHaveBeenCalledTimes(1));
    rerender(<Editor dirty={false} />);
    const cleanUnload = new Event("beforeunload", { cancelable: true });
    fireEvent(window, cleanUnload);
    expect(cleanUnload.defaultPrevented).toBe(false);
  });
});
