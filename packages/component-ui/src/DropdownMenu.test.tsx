import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DropdownMenu, DropdownMenuItem } from "./DropdownMenu";

afterEach(cleanup);

describe("DropdownMenu", () => {
  it("moves focus through menu items and returns it to the trigger on Escape", () => {
    render(
      <DropdownMenu trigger="Actions">
        <DropdownMenuItem onClick={vi.fn()}>Rename</DropdownMenuItem>
        <DropdownMenuItem onClick={vi.fn()}>Delete</DropdownMenuItem>
      </DropdownMenu>,
    );

    const trigger = screen.getByRole("button", { name: "Actions" });

    fireEvent.click(trigger);
    const menu = screen.getByRole("menu");
    const items = screen.getAllByRole("menuitem");

    fireEvent.keyDown(menu, { key: "ArrowDown" });
    expect(document.activeElement).toBe(items[0]);
    fireEvent.keyDown(menu, { key: "End" });
    expect(document.activeElement).toBe(items[1]);
    fireEvent.keyDown(menu, { key: "ArrowDown" });
    expect(document.activeElement).toBe(items[0]);
    fireEvent.keyDown(menu, { key: "Escape" });

    expect(screen.queryByRole("menu")).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it("opens from the keyboard and closes when the document body is clicked", () => {
    render(
      <>
        <DropdownMenu trigger="Actions">
          <DropdownMenuItem>Rename</DropdownMenuItem>
        </DropdownMenu>
        <button type="button">Outside</button>
      </>,
    );

    const trigger = screen.getByRole("button", { name: "Actions" });

    fireEvent.keyDown(trigger, { key: "Enter" });
    expect(screen.getByRole("menu")).toBeTruthy();
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole("menu")).toBeNull();
  });
});
