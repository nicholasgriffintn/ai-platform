import { ownsResource } from "@ngriffin_uk/polychat-library-policy";
import { DISCOVER_RECIPE_ID, type RecipeExecutionTaskData } from "@ngriffin_uk/polychat-schemas";
import { doesCronMatchDateInTimezone } from "@ngriffin_uk/polychat-utility-server/cron";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { requirePolyContext } from "~/modules/poly/application/poly-context";
import { isPolyContextPaused } from "~/modules/poly/domain/pause";
import { parseRecipeInstallationRecord } from "~/modules/recipes/application";
import { TemplateRepository } from "~/modules/templates/infrastructure/TemplateRepository";

const OCCURRENCE_LIFETIME_MS = 2 * 60 * 60 * 1000;

export async function readCurrentDiscoverOccurrence(
  context: ServiceContext,
  data: RecipeExecutionTaskData,
  now: Date,
) {
  if (!data.installationId || !data.scheduledAt || !data.discoverOperation) {
    return null;
  }

  const user = context.requireUser();
  const record = await context.repositories
    .get(TemplateRepository)
    .getTemplateById(data.installationId);

  if (!record || record.project_id !== null) {
    return null;
  }

  if (!ownsResource(user.id, record.created_by_user_id)) {
    return null;
  }

  const installation = parseRecipeInstallationRecord(record);

  if (!installation || installation.recipeId !== DISCOVER_RECIPE_ID) {
    return null;
  }

  if (installation.status !== "active") {
    return null;
  }

  const poly = await requirePolyContext(context);

  if (installation.teammateContextId !== poly.id || isPolyContextPaused(poly, now.getTime())) {
    return null;
  }

  const trigger = installation.triggers.find((candidate) => candidate.id === data.triggerId);

  if (!trigger?.enabled || !trigger.cronExpression) {
    return null;
  }

  if (trigger.discoverOperation !== data.discoverOperation) {
    return null;
  }

  const scheduled = new Date(data.scheduledAt);
  const age = now.getTime() - scheduled.getTime();

  if (!Number.isFinite(age) || age < 0 || age > OCCURRENCE_LIFETIME_MS) {
    return null;
  }

  const occurrenceId = `${trigger.id}:${scheduled.toISOString().slice(0, 16)}`;

  if (data.occurrenceId !== occurrenceId) {
    return null;
  }

  if (!doesCronMatchDateInTimezone(trigger.cronExpression, scheduled, trigger.timezone ?? "UTC")) {
    return null;
  }

  return { installationId: record.id, operation: data.discoverOperation, scheduled };
}
