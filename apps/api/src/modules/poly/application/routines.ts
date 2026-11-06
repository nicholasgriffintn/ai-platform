import {
  isPolyTeammateId,
  POLY_HANDOFF_CAPABILITY_ID,
  POLY_ROUTINE_TEMPLATES,
  polyRoutineCron,
  type PolyRoutine,
  type PolyRoutineBrief,
  type PolyRoutineSetup,
  type PolyRoutines,
  type PolyRoutineTemplate,
  type PolyRoutineTemplateId,
  type RecipeInstallation,
  type SetupPolyRoutine,
  type TeammateContext,
} from "@ngriffin_uk/polychat-schemas";
import {
  DAY_MS,
  isValidTimeZone,
  markdownToPlainText,
  truncateSingleLine,
} from "@ngriffin_uk/polychat-utility-core";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { ActivityRepository } from "~/modules/activity/infrastructure/ActivityRepository";
import { getChannelAdapter } from "~/modules/channels/infrastructure/adapters";
import { ChannelBindingRepository } from "~/modules/channels/infrastructure/ChannelBindingRepository";
import {
  deleteRecipeInstallation,
  installAssistantRecipe,
  listRecipeInstallations,
} from "~/modules/recipes/application";

import { readPolyHandoff } from "./handoffs";
import { requirePolyContext } from "./poly-context";

const BRIEF_SCAN_LIMIT = 40;
const BRIEF_LIMIT = 6;
const BRIEF_SUMMARY_CHARS = 280;

async function listPolyInstallations(context: ServiceContext, polyContext: TeammateContext) {
  const { installations } = await listRecipeInstallations({
    context,
    userId: context.requireUser().id,
  });

  return installations.filter((installation) => installation.teammateContextId === polyContext.id);
}

function describeRoutine(
  template: PolyRoutineTemplate,
  installation: RecipeInstallation | undefined,
): PolyRoutine {
  const schedule = installation?.triggers.find((trigger) => trigger.type === "schedule");
  const [minutes, hours] = schedule?.cronExpression?.split(" ") ?? [];

  return {
    id: template.id,
    title: template.title,
    summary: template.summary,
    bounds: template.bounds,
    cadence: template.cadence,
    time:
      hours && minutes ? `${hours.padStart(2, "0")}:${minutes.padStart(2, "0")}` : template.time,
    timezone: schedule?.timezone ?? null,
    installation_id: installation?.id ?? null,
    sms_target:
      schedule?.notificationChannel === "sms" ? (schedule.notificationTarget ?? null) : null,
  };
}

export async function listPolyRoutineBriefs(
  context: ServiceContext,
  polyContext: TeammateContext,
  now = Date.now(),
): Promise<PolyRoutineBrief[]> {
  const records = await context.repositories
    .get(ActivityRepository)
    .listConversationActivitiesSince({
      conversationId: polyContext.homeConversationId,
      capabilityId: POLY_HANDOFF_CAPABILITY_ID,
      since: new Date(now - DAY_MS).toISOString(),
      limit: BRIEF_SCAN_LIMIT,
    });
  const seenOccurrences = new Set<string>();

  return records
    .flatMap((record) => {
      const handoff = readPolyHandoff(record);
      const occurrence = record.group_id?.split(":").slice(0, -1).join(":") ?? record.id;

      if (!handoff || seenOccurrences.has(occurrence)) {
        return [];
      }

      seenOccurrences.add(occurrence);

      return [
        {
          id: handoff.id,
          title: handoff.title,
          summary: truncateSingleLine(
            markdownToPlainText(handoff.data.summary),
            BRIEF_SUMMARY_CHARS,
          ),
          needs_you: record.group_id?.endsWith(":attention") === true,
          conversation_id: handoff.data.resultConversationId,
          created_at: handoff.createdAt,
        },
      ];
    })
    .slice(0, BRIEF_LIMIT);
}

async function listApprovalChannels(context: ServiceContext): Promise<string[]> {
  const user = context.requireUser();
  const bindings = await context.repositories.get(ChannelBindingRepository).listForUser(user.id);
  const labels = bindings.flatMap((binding) =>
    binding.enabled &&
    isPolyTeammateId(binding.teammate_id) &&
    binding.scope_type === "personal" &&
    binding.scope_id === String(user.id)
      ? [getChannelAdapter(binding.channel)?.label ?? binding.channel]
      : [],
  );

  return [...new Set(labels)];
}

export async function readPolyRoutines(context: ServiceContext): Promise<PolyRoutines> {
  const polyContext = await requirePolyContext(context);
  const [installations, briefs, approvalChannels] = await Promise.all([
    listPolyInstallations(context, polyContext),
    listPolyRoutineBriefs(context, polyContext),
    listApprovalChannels(context),
  ]);

  return {
    routines: POLY_ROUTINE_TEMPLATES.map((template) =>
      describeRoutine(
        template,
        installations.find((installation) => installation.recipeId === template.id),
      ),
    ),
    briefs,
    approval_channels: approvalChannels,
  };
}

export async function setupPolyRoutine(
  context: ServiceContext,
  input: SetupPolyRoutine,
): Promise<PolyRoutineSetup> {
  const template = POLY_ROUTINE_TEMPLATES.find((candidate) => candidate.id === input.template_id);

  if (!template) {
    throw new AssistantError("That routine does not exist", ErrorType.NOT_FOUND, 404);
  }

  const polyContext = await requirePolyContext(context);
  const installed = await installAssistantRecipe(template.id, {
    context,
    userId: context.requireUser().id,
    channel: "web",
    teammateContextId: polyContext.id,
    triggers: [
      {
        type: "schedule",
        enabled: true,
        cronExpression: polyRoutineCron(template, input.time),
        timezone: input.timezone && isValidTimeZone(input.timezone) ? input.timezone : "UTC",
        ...(input.sms_target
          ? { notificationChannel: "sms" as const, notificationTarget: input.sms_target }
          : {}),
      },
    ],
  });

  if (!installed) {
    throw new AssistantError("That routine is not available yet", ErrorType.NOT_FOUND, 404);
  }

  return {
    routine: describeRoutine(template, installed.installation),
    ready: installed.readyToRun,
    missing_connections: installed.readyToRun
      ? []
      : installed.connections.filter((item) => item.requiresConnection).map((item) => item.name),
  };
}

export async function removePolyRoutine(
  context: ServiceContext,
  templateId: PolyRoutineTemplateId,
): Promise<{ deleted: true }> {
  const polyContext = await requirePolyContext(context);
  const installation = (await listPolyInstallations(context, polyContext)).find(
    (candidate) => candidate.recipeId === templateId,
  );

  if (installation) {
    await deleteRecipeInstallation({
      context,
      userId: context.requireUser().id,
      installationId: installation.id,
    });
  }

  return { deleted: true };
}
