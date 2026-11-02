import type { DiscoverDayProfile, UpdateDiscoverDayProfile } from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { buildDiscoverScheduleTriggers } from "~/modules/discover/domain/schedules";
import {
  getRecipeInstallationRecord,
  updateRecipeInstallation,
} from "~/modules/recipes/application";

import { queueDiscoverCurrent } from "./current";
import { saveDiscoverDayProfile } from "./day-profile";
import { readDiscoverRoutine, updateDiscoverSettings } from "./settings";

export async function configureDiscoverDay(
  context: ServiceContext,
  input: UpdateDiscoverDayProfile,
): Promise<DiscoverDayProfile> {
  const saved = await saveDiscoverDayProfile(context, input);

  if (input.enabled !== undefined) {
    await updateDiscoverSettings(context, { enabled: input.enabled }, null);
  }

  const routine = await readDiscoverRoutine(context);

  if (routine.enabled && routine.installationId) {
    const existing = await getRecipeInstallationRecord({
      context,
      userId: context.requireUser().id,
      installationId: routine.installationId,
    });
    const listen = input.audio
      ? saved.audio.morning.enabled || saved.audio.evening.enabled
      : routine.listen;

    await updateRecipeInstallation({
      context,
      userId: context.requireUser().id,
      installationId: routine.installationId,
      update: {
        triggers: buildDiscoverScheduleTriggers(saved, { ...routine, listen }),
        ...(existing && input.audio
          ? { configuration: { ...existing.data.configuration, listen } }
          : {}),
      },
    });
    await queueDiscoverCurrent(context);
  }

  return saved;
}
