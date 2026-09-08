import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ModelTierPicker } from "./ModelTierPicker";
import { RuntimeRail } from "./RuntimeRail";

afterEach(cleanup);

describe("model selection", () => {
  it("does not mark an automatic tier selected when an explicit model is active", () => {
    const { rerender } = render(
      <ModelTierPicker
        runtime="hosted"
        selectedTier={null}
        active={false}
        onSelectTier={vi.fn()}
      />,
    );

    expect(
      screen
        .getAllByRole("option")
        .every((option) => option.getAttribute("aria-selected") === "false"),
    ).toBe(true);
    rerender(
      <ModelTierPicker runtime="hosted" selectedTier={null} active onSelectTier={vi.fn()} />,
    );
    expect(screen.getByRole("option", { name: "Default tier" }).getAttribute("aria-selected")).toBe(
      "true",
    );
  });

  it("lets the user select Browser before its models have loaded", () => {
    const onSelect = vi.fn();

    render(
      <RuntimeRail
        options={[
          { site: "hosted", label: "Polychat" },
          { site: "browser", label: "Browser" },
        ]}
        selected="hosted"
        onSelect={onSelect}
      />,
    );
    fireEvent.click(screen.getByRole("radio", { name: "Browser" }));
    expect(onSelect).toHaveBeenCalledWith("browser", undefined);
  });
});
