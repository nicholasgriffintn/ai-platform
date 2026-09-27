import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Switch } from "./Switch";

describe("Switch", () => {
  it("connects the label and description without requiring an explicit ID", () => {
    const onChange = vi.fn();

    render(
      <Switch
        label="Flagged only"
        description="Show rows needing review"
        checked={false}
        onChange={onChange}
      />,
    );
    const control = screen.getByRole("switch", { name: "Flagged only" });

    expect(control).toHaveAccessibleDescription("Show rows needing review");
    fireEvent.click(screen.getByText("Flagged only"));
    expect(onChange).toHaveBeenCalledOnce();
  });
  it("uses one labelled native control for switch interaction", () => {
    const onChange = vi.fn();

    render(
      <Switch
        id="temporary-mode"
        label="Temporary mode"
        description="Start new chats locally by default."
        checked={false}
        onChange={onChange}
      />,
    );

    const control = screen.getByRole("switch", { name: "Temporary mode" });

    expect(control.tagName).toBe("INPUT");
    expect(control.closest("button")).toBeNull();
    expect(control).toHaveAttribute("aria-describedby", "temporary-mode-description");

    fireEvent.click(control);

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ target: control }));
  });
});
