import { ownsResource } from "@ngriffin_uk/polychat-library-policy";
import type { UpdateDiscoverDayProfile } from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import { ConversationRepository } from "~/modules/conversations/infrastructure/ConversationRepository";
import { requirePolyContext } from "~/modules/poly/application/poly-context";
import { isPolyNavigationTurn } from "~/modules/tools/application/poly-turn-policy";
import type { ApiToolDefinition, ApiToolExecutionContext } from "~/types/functions";

import { readDiscoverDayProfile } from "../day-profile";
import { configureDiscoverDay } from "../day-settings";
import { readDiscoverRoutine } from "../settings";
import {
  read_discover_day as readDescriptor,
  update_discover_day as updateDescriptor,
} from "./definitions/day";

async function requireDiscoverDayOwner({ request }: ApiToolExecutionContext) {
  if (!request.context || !request.user?.id) {
    throw new AssistantError(
      "Day preferences need a signed-in user",
      ErrorType.AUTHENTICATION_ERROR,
      401,
    );
  }

  if (
    !isPolyNavigationTurn({
      conversationType: request.request?.conversation_type,
      trigger: request.request?.trigger,
    })
  ) {
    throw new AssistantError(
      "Day preferences can only be configured in your personal Poly conversation",
      ErrorType.FORBIDDEN,
      403,
    );
  }

  const owner = request.context.requireUser();
  const conversation = request.request?.completion_id
    ? await request.context.repositories
        .get(ConversationRepository)
        .getConversation(request.request.completion_id)
    : null;

  if (
    owner.id !== request.user.id ||
    !conversation ||
    !ownsResource(owner.id, conversation.user_id) ||
    conversation.project_id !== null
  ) {
    throw new AssistantError(
      "Day preferences require your personal Poly conversation",
      ErrorType.FORBIDDEN,
      403,
    );
  }

  const poly = await requirePolyContext(request.context);

  if (conversation.id !== poly.homeConversationId) {
    throw new AssistantError(
      "Day preferences require your personal Poly conversation",
      ErrorType.FORBIDDEN,
      403,
    );
  }

  return request.context;
}

export const read_discover_day: ApiToolDefinition = {
  ...readDescriptor,
  execute: async (_args, toolContext) => {
    const context = await requireDiscoverDayOwner(toolContext);
    const [profile, routine] = await Promise.all([
      readDiscoverDayProfile(context),
      readDiscoverRoutine(context),
    ]);

    return {
      name: "read_discover_day",
      status: "success",
      content: "These are the person's explicit saved day preferences.",
      data: { ...profile, enabled: routine.enabled, podcastsEnabled: routine.listen },
    };
  },
};

export const update_discover_day: ApiToolDefinition = {
  ...updateDescriptor,
  execute: async (args: UpdateDiscoverDayProfile, toolContext) => {
    const profile = await configureDiscoverDay(await requireDiscoverDayOwner(toolContext), args);

    return {
      name: "update_discover_day",
      status: "success",
      content: args.override
        ? `Saved the ${args.override.mode} override for ${args.override.date} in ${profile.timezone}. The weekly routine is unchanged.`
        : "Saved the requested day preferences.",
      data: profile,
    };
  },
};
