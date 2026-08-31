import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DropdownMenu, DropdownMenuItem } from "./DropdownMenu";

function renderMenu(onRename = vi.fn(), onDelete = vi.fn()) {
  render(
    <DropdownMenu trigger="Options">
      <DropdownMenuItem onClick={onRename}>Rename</DropdownMenuItem>
      <DropdownMenuItem onClick={vi.fn()} disabled>
        Archive
      </DropdownMenuItem>
      <DropdownMenuItem onClick={onDelete}>Delete</DropdownMenuItem>
    </DropdownMenu>,
  );

  return {
    onDelete,
    onRename,
    trigger: screen.getByRole("button", { name: "Options" }),
  };
}

describe("DropdownMenu", () => {
  afterEach(() => {
    cleanup();
  });

  it("moves focus into the menu so a keyboard user can reach the items", () => {
    const { trigger } = renderMenu();

    fireEvent.click(trigger);

    expect(screen.getByRole("menuitem", { name: "Rename" })).toHaveFocus();
  });

  it("opens from the trigger with the down arrow", () => {
    const { trigger } = renderMenu();

    trigger.focus();
    fireEvent.keyDown(trigger, { key: "ArrowDown" });

    expect(screen.getByRole("menu")).toBeInTheDocument();
  });

  it("cycles items with the arrow keys and skips disabled ones", () => {
    const { trigger } = renderMenu();

    fireEvent.click(trigger);
    fireEvent.keyDown(screen.getByRole("menu"), { key: "ArrowDown" });

    expect(screen.getByRole("menuitem", { name: "Delete" })).toHaveFocus();

    fireEvent.keyDown(screen.getByRole("menu"), { key: "ArrowDown" });

    expect(screen.getByRole("menuitem", { name: "Rename" })).toHaveFocus();
  });

  it("activates the focused item with Enter", () => {
    const { onDelete, trigger } = renderMenu();

    fireEvent.click(trigger);
    fireEvent.keyDown(screen.getByRole("menu"), { key: "End" });
    fireEvent.click(screen.getByRole("menuitem", { name: "Delete" }));

    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it("closes on Escape and hands focus back to the trigger", () => {
    const { trigger } = renderMenu();

    fireEvent.click(trigger);
    fireEvent.keyDown(screen.getByRole("menu"), { key: "Escape" });

    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("names the menu after a trigger that actually exists", () => {
    const { trigger } = renderMenu();

    fireEvent.click(trigger);

    expect(screen.getByRole("menu")).toHaveAttribute("aria-labelledby", trigger.id);
    expect(trigger.id).not.toBe("");
  });
});
