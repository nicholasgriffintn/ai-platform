import {
  DEFAULT_PET_PRESET_SLUG,
  isPetPresetSlug,
  petModelOverridesSchema,
  type PetSelection,
} from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/lib/context/serviceContext";
import { AssistantError, ErrorType } from "~/utils/errors";

function assertPresetExists(selection: PetSelection): void {
  if (selection.pet_source === "preset" && !isPetPresetSlug(selection.pet_id)) {
    throw new AssistantError("Pet preset not found", ErrorType.PARAMS_ERROR, 400);
  }
}

export async function validatePetSettingsUpdate(
  context: ServiceContext,
  userId: number,
  settings: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const nextSettings = { ...settings };
  const selections: PetSelection[] = [];
  const changesDefaultPet =
    Object.hasOwn(settings, "pet_source") || Object.hasOwn(settings, "pet_id");

  if (changesDefaultPet) {
    const current = await context.repositories.userSettings.getUserSettings(userId);
    const petSource =
      settings.pet_source === "custom" || settings.pet_source === "preset"
        ? settings.pet_source
        : (current?.pet_source ?? "preset");
    const petId =
      typeof settings.pet_id === "string"
        ? settings.pet_id
        : (current?.pet_id ?? DEFAULT_PET_PRESET_SLUG);

    selections.push({ pet_source: petSource, pet_id: petId });
  }

  if (Object.hasOwn(settings, "pet_model_overrides")) {
    const overrides = petModelOverridesSchema.safeParse(settings.pet_model_overrides);

    if (!overrides.success) {
      throw new AssistantError("Invalid pet model overrides", ErrorType.PARAMS_ERROR, 400);
    }

    nextSettings.pet_model_overrides = overrides.data;
    selections.push(
      ...Object.values(overrides.data.families),
      ...Object.values(overrides.data.providers),
      ...Object.values(overrides.data.makers),
    );
  }

  for (const selection of selections) {
    assertPresetExists(selection);
  }

  const customPetIds = new Set(
    selections
      .filter((selection) => selection.pet_source === "custom")
      .map((selection) => selection.pet_id),
  );

  if (customPetIds.size > 0) {
    const ownedPetIds = await context.repositories.userPets.listOwnedPetIds(userId, [
      ...customPetIds,
    ]);

    for (const petId of customPetIds) {
      if (!ownedPetIds.has(petId)) {
        throw new AssistantError("Custom pet not found", ErrorType.PARAMS_ERROR, 400);
      }
    }
  }

  return nextSettings;
}
