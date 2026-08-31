import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ToolToggleMenu } from "./ToolToggleMenu";

describe("ToolToggleMenu", () => {
  it("keeps toggle pointer events inside the open menu", () => {
    const onParentPointerDown = vi.fn();
    const onParentClick = vi.fn();
    const onToggle = vi.fn();

    render(
      <div role="presentation" onPointerDown={onParentPointerDown} onClick={onParentClick}>
        <ToolToggleMenu
          showHeading={false}
          options={[
            {
              key: "code_execution",
              label: "Code execution",
              icon: <span />,
              isPressed: false,
              onToggle,
            },
          ]}
        />
      </div>,
    );

    const toggle = screen.getByRole("button", { name: "Code execution" });

    fireEvent.pointerDown(toggle);
    fireEvent.click(toggle);

    expect(onToggle).toHaveBeenCalledOnce();
    expect(onParentPointerDown).not.toHaveBeenCalled();
    expect(onParentClick).not.toHaveBeenCalled();
  });
});
