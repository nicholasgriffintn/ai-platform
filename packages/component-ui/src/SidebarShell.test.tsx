import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SidebarShell } from "./SidebarShell";

afterEach(cleanup);

function Harness({ isMobile = true }: { isMobile?: boolean }) {
  const [visible, setVisible] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setVisible(true)}>
        Open sidebar
      </button>
      <SidebarShell
        visible={visible}
        isMobile={isMobile}
        onClose={() => setVisible(false)}
        label="Conversations"
      >
        <button type="button">New chat</button>
      </SidebarShell>
    </>
  );
}

describe("SidebarShell mobile drawer", () => {
  it("moves focus in on open and returns it to the toggle on close", () => {
    render(<Harness />);

    const toggle = screen.getByRole("button", { name: "Open sidebar" });

    toggle.focus();
    fireEvent.click(toggle);

    expect(screen.getByRole("dialog", { name: "Conversations" })).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "New chat" }));

    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(toggle);
  });

  it("dismisses from the backdrop, which is a real labelled control", () => {
    const onClose = vi.fn();

    render(
      <SidebarShell visible isMobile onClose={onClose}>
        <button type="button">New chat</button>
      </SidebarShell>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Close sidebar" }));

    expect(onClose).toHaveBeenCalledOnce();
  });

  it("leaves the docked desktop sidebar alone", () => {
    const onClose = vi.fn();

    render(
      <SidebarShell visible isMobile={false} onClose={onClose}>
        <button type="button">New chat</button>
      </SidebarShell>,
    );

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.queryByRole("button", { name: "Close sidebar" })).toBeNull();

    fireEvent.keyDown(document, { key: "Escape" });

    expect(onClose).not.toHaveBeenCalled();
  });
});
