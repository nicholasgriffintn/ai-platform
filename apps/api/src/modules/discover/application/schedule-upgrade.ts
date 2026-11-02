import { ownsResource } from "@ngriffin_uk/polychat-library-policy";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { buildDiscoverScheduleTriggers } from "~/modules/discover/domain/schedules";
import {
  parseRecipeInstallationRecord,
  updateRecipeInstallation,
} from "~/modules/recipes/application";
import { TemplateRepository } from "~/modules/templates/infrastructure/TemplateRepository";

import { readDiscoverDayProfile, saveDiscoverDayProfile } from "./day-profile";
import type { DiscoverRoutineSettings } from "./settings";

export async function ensureDiscoverLiveSchedule(
  context: ServiceContext,
  settings: DiscoverRoutineSettings,
): Promise<void> {
  if (!settings.enabled || !settings.installationId) {
    return;
  }

  const user = context.requireUser();
  const record = await context.repositories
    .get(TemplateRepository)
    .getTemplateById(settings.installationId);
  const installation = record ? parseRecipeInstallationRecord(record) : null;

  if (
    !record ||
    record.project_id !== null ||
    !ownsResource(user.id, record.created_by_user_id) ||
    !installation
  ) {
    return;
  }

  let profile = await readDiscoverDayProfile(context);

  if (profile.revision === 0 && settings.timezone) {
    profile = await saveDiscoverDayProfile(context, {
      expectedRevision: 0,
      timezone: settings.timezone,
    });
  }

  const added = buildDiscoverScheduleTriggers(profile, settings)
    .filter((trigger) => trigger.discoverOperation)
    .map((trigger) => ({
      ...trigger,
      enabled:
        installation.triggers.find((current) => current.id === trigger.id)?.enabled ??
        trigger.enabled,
    }));
  const current = installation.triggers.filter((trigger) => trigger.discoverOperation);

  if (JSON.stringify(current) === JSON.stringify(added)) {
    return;
  }

  await updateRecipeInstallation({
    context,
    userId: user.id,
    installationId: settings.installationId,
    update: {
      triggers: [
        ...installation.triggers.filter((trigger) => !trigger.discoverOperation),
        ...added,
      ],
    },
  });
}
