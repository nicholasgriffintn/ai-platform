import { describe, expect, it } from "vitest";

import {
  EMPTY_PET_MODEL_OVERRIDES,
  removeCustomPetFromModelOverrides,
  resolvePetForModel,
  resolvePetSelectionForModel,
  type PetModelOverrides,
  type PetSelection,
  type UserPet,
} from "./pets";

const defaultSelection: PetSelection = { pet_source: "preset", pet_id: "ash" };

const overrides: PetModelOverrides = {
  families: {
    "claude-sonnet": { pet_source: "preset", pet_id: "ash" },
  },
  providers: {
    anthropic: { pet_source: "preset", pet_id: "kea" },
  },
  makers: {
    anthropic: { pet_source: "preset", pet_id: "moss" },
  },
};

describe("model-aware pet selection", () => {
  it("prefers a model family override over its provider override", () => {
    expect(
      resolvePetSelectionForModel(defaultSelection, overrides, {
        family: " Claude-Sonnet ",
        provider: "Anthropic",
      }),
    ).toEqual({ pet_source: "preset", pet_id: "ash" });
  });

  it("uses the provider before falling back to the default selection", () => {
    expect(
      resolvePetSelectionForModel(defaultSelection, overrides, {
        family: "claude-opus",
        provider: "ANTHROPIC",
      }),
    ).toEqual({ pet_source: "preset", pet_id: "kea" });

    expect(
      resolvePetSelectionForModel(defaultSelection, overrides, {
        family: "gpt",
        provider: "openai",
      }),
    ).toEqual(defaultSelection);
  });

  it("falls back to the maker when a model is served by another provider", () => {
    expect(
      resolvePetSelectionForModel(defaultSelection, overrides, {
        family: "claude-opus",
        provider: "openrouter",
      }),
    ).toEqual({ pet_source: "preset", pet_id: "moss" });
  });

  it("uses the default selection when no model is selected", () => {
    expect(resolvePetSelectionForModel(defaultSelection, EMPTY_PET_MODEL_OVERRIDES, null)).toEqual(
      defaultSelection,
    );
  });

  it("recovers to the default preset when an override references a missing custom pet", () => {
    const customOverride: PetModelOverrides = {
      families: {},
      providers: {
        openai: { pet_source: "custom", pet_id: "missing" },
      },
      makers: {},
    };

    expect(
      resolvePetForModel(defaultSelection, customOverride, { provider: "openai" }, []),
    ).toMatchObject({ source: "preset", id: "ash", name: "Ash" });
  });

  it("resolves a custom override when the pet exists", () => {
    const customPet: UserPet = {
      id: "pet-1",
      name: "Orbit",
      description: null,
      origin: "upload",
      sheet_url: "/user/pets/pet-1/sheet",
      layout_id: "polychat-v1",
      prompt: null,
      created_at: "2026-08-30T00:00:00.000Z",
    };
    const customOverride: PetModelOverrides = {
      families: {},
      providers: {
        openai: { pet_source: "custom", pet_id: customPet.id },
      },
      makers: {},
    };

    expect(
      resolvePetForModel(defaultSelection, customOverride, { provider: "openai" }, [customPet]),
    ).toMatchObject({ source: "custom", id: customPet.id, name: "Orbit" });
  });

  it("removes a deleted custom pet without touching preset assignments", () => {
    expect(
      removeCustomPetFromModelOverrides(
        {
          families: {
            gpt: { pet_source: "custom", pet_id: "pet-1" },
            claude: { pet_source: "preset", pet_id: "pet-1" },
          },
          providers: {
            openai: { pet_source: "custom", pet_id: "pet-1" },
            anthropic: { pet_source: "custom", pet_id: "pet-2" },
          },
          makers: {
            openai: { pet_source: "custom", pet_id: "pet-1" },
          },
        },
        "pet-1",
      ),
    ).toEqual({
      families: { claude: { pet_source: "preset", pet_id: "pet-1" } },
      providers: { anthropic: { pet_source: "custom", pet_id: "pet-2" } },
      makers: {},
    });
  });
});
