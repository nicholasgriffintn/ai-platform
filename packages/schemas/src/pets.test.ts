import { describe, expect, it } from "vitest";

import {
  EMPTY_PET_MODEL_OVERRIDES,
  parsePetModelOverrides,
  removeCustomPetFromModelOverrides,
  resolvePetForModel,
  resolvePetSelectionForModel,
  type PetModelOverrides,
  type PetSelection,
  type UserPet,
} from "./pets.js";

const defaultSelection: PetSelection = { pet_source: "preset", pet_id: "ash" };

const overrides: PetModelOverrides = {
  states: {},
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
  it("uses a temporary conversation override before model rules", () => {
    expect(
      resolvePetSelectionForModel(
        defaultSelection,
        {
          ...overrides,
          states: {
            temporary: { pet_source: "preset", pet_id: "wisp" },
          },
        },
        { family: "claude-sonnet", provider: "anthropic" },
        "temporary",
      ),
    ).toEqual({ pet_source: "preset", pet_id: "wisp" });
  });

  it("uses Wisp for temporary conversations without an override", () => {
    expect(
      resolvePetSelectionForModel(defaultSelection, EMPTY_PET_MODEL_OVERRIDES, null, "temporary"),
    ).toEqual({ pet_source: "preset", pet_id: "wisp" });

    expect(
      resolvePetForModel(
        defaultSelection,
        EMPTY_PET_MODEL_OVERRIDES,
        { family: "claude-sonnet", provider: "anthropic" },
        "temporary",
      ),
    ).toMatchObject({ source: "preset", id: "wisp", name: "Wisp" });
  });

  it("parses overrides saved before conversation states existed", () => {
    expect(
      parsePetModelOverrides({
        families: { claude: { pet_source: "preset", pet_id: "ash" } },
        providers: {},
        makers: {},
      }),
    ).toEqual({
      states: {},
      families: { claude: { pet_source: "preset", pet_id: "ash" } },
      providers: {},
      makers: {},
    });
  });

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
      states: {},
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
      states: {},
      families: {},
      providers: {
        openai: { pet_source: "custom", pet_id: customPet.id },
      },
      makers: {},
    };

    expect(
      resolvePetForModel(defaultSelection, customOverride, { provider: "openai" }, undefined, [
        customPet,
      ]),
    ).toMatchObject({ source: "custom", id: customPet.id, name: "Orbit" });
  });

  it("removes a deleted custom pet without touching preset assignments", () => {
    expect(
      removeCustomPetFromModelOverrides(
        {
          states: {
            temporary: { pet_source: "custom", pet_id: "pet-1" },
          },
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
      states: {},
      families: { claude: { pet_source: "preset", pet_id: "pet-1" } },
      providers: { anthropic: { pet_source: "custom", pet_id: "pet-2" } },
      makers: {},
    });
  });
});
