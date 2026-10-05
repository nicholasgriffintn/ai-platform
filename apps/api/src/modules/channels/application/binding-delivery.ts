import { ownsResource } from "@ngriffin_uk/polychat-library-policy";
import type { InboundBindingTaskData } from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { ChannelDeliveryChangedError } from "~/modules/channels/domain/errors";
import { getChannelAdapter } from "~/modules/channels/infrastructure/adapters";
import { requireProjectTeammate } from "~/modules/teammates/application/access";
import {
  ensureActiveTeammateContext,
  requireTeammateContext,
} from "~/modules/teammates/application/contexts";
import { requireProjectAccess } from "~/modules/workspaces/application/access";
import type { IEnv, IUser } from "~/types";

import { getChannelBindingConversationId } from "./conversation-identity";
import type { ChannelDelivery } from "./delivery-types";
import { getChannelSecrets } from "./secrets";
import { isChannelThreadCurrent } from "./thread-authority";

export async function resolveBindingDelivery(params: {
  env: IEnv;
  context: ServiceContext;
  user: IUser;
  data: InboundBindingTaskData;
}): Promise<ChannelDelivery> {
  const binding = await params.context.repositories.channelBindings.getById(params.data.bindingId);

  if (
    !binding ||
    !binding.enabled ||
    binding.channel !== params.data.channel ||
    !ownsResource(params.user.id, binding.created_by)
  ) {
    return { status: "channel_unavailable" };
  }

  if (
    !(await isChannelThreadCurrent(
      params.context,
      binding,
      params.data.thread,
      params.data.message.from,
    ))
  ) {
    return { status: "channel_unavailable" };
  }

  if (binding.scope_type === "personal" && binding.scope_id !== String(params.user.id)) {
    return { status: "channel_unavailable" };
  }

  if (binding.scope_type === "project") {
    await requireProjectAccess(params.context, binding.scope_id);
  }

  const adapter = getChannelAdapter(params.data.channel);
  const { reply: replySecret } = getChannelSecrets(params.data.channel, params.env);

  if (!adapter) {
    return { status: "channel_unavailable" };
  }

  if (!replySecret) {
    throw new AssistantError(
      `${adapter.label} has no reply credential configured`,
      ErrorType.CONFIGURATION_ERROR,
    );
  }

  const conversationId = await getChannelBindingConversationId({
    channel: params.data.channel,
    bindingId: binding.id,
    thread: params.data.thread,
  });
  const teammateContext = binding.teammate_id
    ? await ensureActiveTeammateContext(
        params.context,
        binding.teammate_id,
        binding.scope_type === "project"
          ? { type: "project", id: binding.scope_id }
          : { type: "personal", id: String(params.user.id) },
      )
    : null;
  const validate = async () => {
    const current = await params.context.repositories.channelBindings.getById(binding.id);

    if (
      !current ||
      !current.enabled ||
      current.channel !== binding.channel ||
      current.external_id !== binding.external_id ||
      current.created_by !== binding.created_by ||
      current.scope_type !== binding.scope_type ||
      current.scope_id !== binding.scope_id ||
      current.teammate_id !== binding.teammate_id ||
      current.interaction_mode !== binding.interaction_mode ||
      !(await isChannelThreadCurrent(
        params.context,
        current,
        params.data.thread,
        params.data.message.from,
      ))
    ) {
      throw new ChannelDeliveryChangedError();
    }

    if (current.scope_type === "project") {
      if (current.teammate_id) {
        await requireProjectTeammate(params.context, current.scope_id, current.teammate_id);
      } else {
        await requireProjectAccess(params.context, current.scope_id);
      }
    }

    if (teammateContext) {
      const activeContext = await requireTeammateContext(params.context, teammateContext.id);
      const expectedScope =
        current.scope_type === "project"
          ? { type: "project" as const, id: current.scope_id }
          : { type: "personal" as const, id: String(params.user.id) };

      if (
        activeContext.teammateId !== current.teammate_id ||
        activeContext.scope.type !== expectedScope.type ||
        activeContext.scope.id !== expectedScope.id
      ) {
        throw new AssistantError(
          "Teammate context changed before channel use",
          ErrorType.FORBIDDEN,
          403,
        );
      }
    }
  };

  return {
    status: "ready",
    conversationId,
    ...(binding.teammate_id ? { teammateId: binding.teammate_id } : {}),
    ...(teammateContext ? { teammateContextId: teammateContext.id } : {}),
    bindingId: binding.id,
    interactionMode: binding.interaction_mode,
    validate,
    ...(binding.scope_type === "project" ? { projectId: binding.scope_id } : {}),
    send: async (reply) => {
      await validate();

      await adapter.sendReply(
        {
          externalId: binding.external_id,
          threadId: params.data.thread.threadId,
          body: reply.body,
        },
        replySecret,
      );
    },
  };
}
