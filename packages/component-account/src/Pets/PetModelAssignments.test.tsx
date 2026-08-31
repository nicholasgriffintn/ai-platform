import { EMPTY_PET_MODEL_OVERRIDES, type PetModelOverrides } from "@ngriffin_uk/polychat-schemas";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PetModelAssignments } from "./PetModelAssignments";
import type { PetModelTargetOption } from "./petModelTargets";
import type { PetSettingsOption } from "./PetSettings";

const targets: PetModelTargetOption[] = [
  { kind: "maker", value: "anthropic", label: "Anthropic", modelCount: 12 },
  { kind: "provider", value: "openrouter", label: "Openrouter", modelCount: 90 },
  { kind: "family", value: "claude-opus", label: "Claude Opus", modelCount: 4 },
];

const pets: PetSettingsOption[] = [
  { id: "pip", source: "preset", name: "Pip", canDelete: false },
  { id: "moss", source: "preset", name: "Moss", canDelete: false },
];

afterEach(cleanup);

function renderAssignments(overrides: PetModelOverrides, onChange = vi.fn()) {
  render(
    <PetModelAssignments targets={targets} pets={pets} overrides={overrides} onChange={onChange} />,
  );

  return onChange;
}

describe("model companion rules", () => {
  it("assigns a pet to a maker so every model it makes is covered", () => {
    const onChange = renderAssignments(EMPTY_PET_MODEL_OVERRIDES);

    fireEvent.click(screen.getByRole("button", { name: "Add a rule" }));
    fireEvent.change(screen.getByLabelText("Search model targets"), {
      target: { value: "anthro" },
    });

    expect(screen.queryByRole("button", { name: /Openrouter/ })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /Anthropic/ }));
    fireEvent.click(screen.getByRole("button", { name: /Moss/ }));
    fireEvent.click(screen.getByRole("button", { name: "Add rule" }));

    expect(onChange).toHaveBeenCalledWith({
      families: {},
      providers: {},
      makers: { anthropic: { pet_source: "preset", pet_id: "moss" } },
    });
  });

  it("describes a configured rule and drops it back to the default pet", () => {
    const onChange = renderAssignments({
      ...EMPTY_PET_MODEL_OVERRIDES,
      makers: { anthropic: { pet_source: "preset", pet_id: "pip" } },
    });

    expect(screen.getByText("Every Anthropic model, whoever serves it · 12 models")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Use default pet for Anthropic" }));

    expect(onChange).toHaveBeenCalledWith(EMPTY_PET_MODEL_OVERRIDES);
  });

  it("keeps a configured target out of the picker", () => {
    renderAssignments({
      ...EMPTY_PET_MODEL_OVERRIDES,
      makers: { anthropic: { pet_source: "preset", pet_id: "pip" } },
    });

    fireEvent.click(screen.getByRole("button", { name: "Add a rule" }));

    expect(screen.queryByRole("button", { name: /^Anthropic/ })).toBeNull();
    expect(screen.getByRole("button", { name: /Claude Opus/ })).toBeTruthy();
  });
});
