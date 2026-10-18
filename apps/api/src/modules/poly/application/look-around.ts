import {
  POLY_LOOK_AROUND_CRON,
  POLY_LOOK_AROUND_RECIPE_ID,
  type PolyLookAround,
  type TeammateContext,
} from "@ngriffin_uk/polychat-schemas";
import { isValidTimeZone } from "@ngriffin_uk/polychat-utility-core";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import {
  deleteRecipeInstallation,
  installAssistantRecipe,
  listRecipeInstallations,
} from "~/modules/recipes/application";

import { requirePolyContext } from "./poly-context";

async function findLookAroundInstallation(context: ServiceContext, polyContext: TeammateContext) {
  const { installations } = await listRecipeInstallations({
    context,
    userId: context.requireUser().id,
  });

  return (
    installations.find(
      (installation) =>
        installation.recipeId === POLY_LOOK_AROUND_RECIPE_ID &&
        installation.teammateContextId === polyContext.id,
    ) ?? null
  );
}

export async function readPolyLookAround(
  context: ServiceContext,
  polyContext: TeammateContext,
): Promise<PolyLookAround> {
  const installation = await findLookAroundInstallation(context, polyContext);
  const schedule = installation?.triggers.find((trigger) => trigger.type === "schedule");

  return {
    enabled: installation?.status === "active",
    timezone: schedule?.timezone ?? null,
  };
}

export async function setPolyLookAround(
  context: ServiceContext,
  input: { enabled: boolean; timezone?: string },
): Promise<PolyLookAround> {
  const user = context.requireUser();
  const polyContext = await requirePolyContext(context);
  const existing = await findLookAroundInstallation(context, polyContext);

  if (!input.enabled) {
    if (existing) {
      await deleteRecipeInstallation({ context, userId: user.id, installationId: existing.id });
    }

    return { enabled: false, timezone: null };
  }

  const timezone = input.timezone && isValidTimeZone(input.timezone) ? input.timezone : "UTC";
  const installed = await installAssistantRecipe(POLY_LOOK_AROUND_RECIPE_ID, {
    context,
    userId: user.id,
    channel: "web",
    teammateContextId: polyContext.id,
    triggers: [
      { type: "schedule", enabled: true, cronExpression: POLY_LOOK_AROUND_CRON, timezone },
    ],
  });

  if (!installed) {
    throw new AssistantError("Poly cannot look around yet", ErrorType.NOT_FOUND, 404);
  }

  return { enabled: true, timezone };
}
