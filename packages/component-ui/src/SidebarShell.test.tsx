import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SidebarShell } from "./SidebarShell";

describe("SidebarShell peek", () => {
  afterEach(cleanup);

  it("shows the hidden sidebar as an interactive overlay while peeking", () => {
    const onSelect = vi.fn();

    render(
      <SidebarShell visible={false} isMobile={false} peeking onClose={vi.fn()}>
        <button type="button" onClick={onSelect}>
          New chat
        </button>
      </SidebarShell>,
    );

    fireEvent.click(screen.getByRole("button", { name: "New chat" }));

    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it("keeps the sidebar unmounted when the peek is not requested", () => {
    render(
      <SidebarShell visible={false} isMobile={false} onClose={vi.fn()}>
        <button type="button">New chat</button>
      </SidebarShell>,
    );

    expect(screen.queryByRole("button", { name: "New chat" })).not.toBeInTheDocument();
  });

  it("never previews on mobile, where the sidebar is a drawer", () => {
    render(
      <SidebarShell visible={false} isMobile peeking onClose={vi.fn()}>
        <button type="button">New chat</button>
      </SidebarShell>,
    );

    expect(screen.queryByRole("button", { name: "New chat" })).not.toBeInTheDocument();
  });
});
