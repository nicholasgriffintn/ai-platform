import { ownsResource } from "@ngriffin_uk/polychat-library-policy";
import { DISCOVER_CAPABILITY_ID } from "@ngriffin_uk/polychat-schemas";
import { describeZonedInstant } from "@ngriffin_uk/polychat-utility-core";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import { safeParseJson } from "@ngriffin_uk/polychat-utility-server/json";
import { z } from "zod/v4";

import {
  withExecutionActivityContext,
  type ServiceContext,
} from "~/infrastructure/context/serviceContext";
import { ActivityRepository } from "~/modules/activity/infrastructure/ActivityRepository";
import { requirePolyContext } from "~/modules/poly/application/poly-context";
import { isPolyContextPaused } from "~/modules/poly/domain/pause";
import { assertRecipeInstallationWithinBudget } from "~/modules/recipes/application/installation-budget";

import { readDiscoverDayProfile } from "./day-profile";
import { readDiscoverRoutine } from "./settings";

export const backgroundWorkSchema = z.discriminatedUnion("operation", [
  z.object({
    operation: z.literal("audio"),
    sourceId: z.string().min(1),
    date: z.string().min(1),
    slot: z.enum(["morning", "evening"]),
    profileRevision: z.number().int().nonnegative(),
    expiresAt: z.iso.datetime(),
  }),
  z.object({
    operation: z.literal("news"),
    profileRevision: z.number().int().nonnegative(),
    expiresAt: z.iso.datetime(),
  }),
]);

export async function beginDiscoverBackgroundWork(
  context: ServiceContext,
  input: {
    id: string;
    installationId: string;
    data: z.infer<typeof backgroundWorkSchema>;
  },
): Promise<ServiceContext> {
  await context.repositories.get(ActivityRepository).recordActivityOnce({
    id: input.id,
    createdByUserId: context.requireUser().id,
    conversationId: null,
    capabilityId: DISCOVER_CAPABILITY_ID,
    groupId: input.installationId,
    kind: "recipe.execution",
    status: "running",
    summary:
      input.data.operation === "audio" ? "Generate a Discover briefing" : "Assess a Discover alert",
    data: input.data,
    createdAt: new Date().toISOString(),
  });

  await assertDiscoverBackgroundWorkCurrent(
    context,
    input.id,
    input.data.operation === "audio" ? input.data.sourceId : undefined,
  );

  return withExecutionActivityContext(context, input.id);
}

async function readOwnedDiscoverBackgroundWork(context: ServiceContext, activityId: string) {
  const user = context.requireUser();
  const activity = await context.repositories.get(ActivityRepository).getActivityById(activityId);

  if (
    !activity ||
    activity.project_id !== null ||
    !ownsResource(user.id, activity.created_by_user_id)
  ) {
    throw new AssistantError("Discover work is unavailable", ErrorType.FORBIDDEN, 403);
  }

  if (
    !activity.group_id ||
    activity.capability_id !== DISCOVER_CAPABILITY_ID ||
    activity.kind !== "recipe.execution"
  ) {
    throw new AssistantError("Invalid Discover activity", ErrorType.FORBIDDEN, 403);
  }

  return activity;
}

export async function assertDiscoverBackgroundWorkCurrent(
  context: ServiceContext,
  activityId: string,
  sourceId?: string,
): Promise<void> {
  const user = context.requireUser();
  const activity = await readOwnedDiscoverBackgroundWork(context, activityId);

  const parsed = backgroundWorkSchema.safeParse(safeParseJson(activity.data));

  if (
    !parsed.success ||
    activity.status !== "running" ||
    parsed.data.expiresAt <= new Date().toISOString()
  ) {
    throw new AssistantError("Discover work is no longer current", ErrorType.CONFLICT_ERROR, 409);
  }

  const work = parsed.data;
  const [settings, profile, poly] = await Promise.all([
    readDiscoverRoutine(context),
    readDiscoverDayProfile(context),
    requirePolyContext(context),
  ]);

  if (!settings.enabled || settings.installationId !== activity.group_id) {
    throw new AssistantError(
      "The Discover routine is no longer active",
      ErrorType.CONFLICT_ERROR,
      409,
    );
  }

  if (profile.revision !== work.profileRevision || isPolyContextPaused(poly, Date.now())) {
    throw new AssistantError("Discover preferences changed", ErrorType.CONFLICT_ERROR, 409);
  }

  if (work.operation === "audio") {
    if (sourceId !== work.sourceId || !settings.listen || !profile.audio[work.slot].enabled) {
      throw new AssistantError(
        "The Discover briefing is no longer enabled",
        ErrorType.CONFLICT_ERROR,
        409,
      );
    }

    if (describeZonedInstant(new Date(), profile.timezone).date !== work.date) {
      throw new AssistantError(
        "The Discover briefing is out of date",
        ErrorType.CONFLICT_ERROR,
        409,
      );
    }
  } else if (!profile.notifications.enabled || !profile.notifications.news) {
    throw new AssistantError("Discover news alerts are disabled", ErrorType.CONFLICT_ERROR, 409);
  }

  if (activity.group_id) {
    await assertRecipeInstallationWithinBudget({
      context,
      userId: user.id,
      installationId: activity.group_id,
    });
  }
}

export async function finishDiscoverBackgroundWork(
  context: ServiceContext,
  status: "succeeded" | "failed",
) {
  if (context.executionActivityId) {
    await readOwnedDiscoverBackgroundWork(context, context.executionActivityId);
    await context.repositories
      .get(ActivityRepository)
      .updateActivity(context.executionActivityId, { status });
  }
}
