import {
  createChatCompletionsJsonSchema,
  INBOUND_CHANNEL_IDS,
  type InboundChannelId,
} from "@ngriffin_uk/polychat-schemas";

import { getInboundChannelProfile } from "~/lib/chat/policy/channels";
import type { ServiceContext } from "~/lib/context/serviceContext";
import { ConversationManager } from "~/lib/conversationManager";
import {
  isAuthorisedSender,
  MESSAGING_PROVIDER_IDS,
  normaliseMessagingAddress,
  type IncomingMessage,
  type MessagingProvider,
  type MessagingProviderId,
} from "~/lib/providers/capabilities/messaging";
import {
  resolveStoredMessagingProvider,
  selectConfiguredMessagingDelivery,
} from "~/lib/providers/capabilities/messaging/delivery";
import { recoverChatCompletionResponse } from "~/services/chat-runs/completion-recovery";
import { handleCreateChatCompletions } from "~/services/completions/createChatCompletions";
import { deliverOutboundOperation } from "~/services/delivery/outbound";
import { requireProjectTeammate } from "~/services/teammates/access";
import { ensureActiveTeammateContext, requireTeammateContext } from "~/services/teammates/contexts";
import { enqueueTeammateRun } from "~/services/teammates/run-admission";
import { requireProjectAccess } from "~/services/workspaces/access";
import type { IEnv, IUser, Message } from "~/types";
import { sha256Hex } from "~/utils/crypto";
import { AssistantError, ErrorType } from "~/utils/errors";
import { buildInboundMessageContent, extractChatCompletionNotification } from "~/utils/messages";
import { isRecord } from "~/utils/objects";

import { getChannelAdapter, type ChannelIncomingMessage } from "./adapters";
import { getChannelSecrets } from "./secrets";

export interface InboundChannelMessage {
  messageId: string;
  from: string;
  to?: string;
  body: string;
  media?: { url: string; mimeType?: string }[];
}

interface InboundChannelTaskBase {
  channel: InboundChannelId;
  message: InboundChannelMessage;
}

export interface InboundProviderTaskData extends InboundChannelTaskBase {
  providerId: MessagingProviderId;
  providerSettingsId: string;
}

export interface InboundBindingTaskData extends InboundChannelTaskBase {
  bindingId: string;
}

export type InboundChannelTaskData = InboundProviderTaskData | InboundBindingTaskData;

export function isInboundBindingTaskData(
  data: InboundChannelTaskData,
): data is InboundBindingTaskData {
  return "bindingId" in data;
}

function isInboundChannelId(value: unknown): value is InboundChannelId {
  return typeof value === "string" && INBOUND_CHANNEL_IDS.some((channel) => channel === value);
}

function isMessagingProviderId(value: unknown): value is MessagingProviderId {
  return typeof value === "string" && MESSAGING_PROVIDER_IDS.some((provider) => provider === value);
}

function parseInboundMessage(value: unknown): InboundChannelMessage | null {
  if (
    !isRecord(value) ||
    typeof value.messageId !== "string" ||
    !value.messageId ||
    typeof value.from !== "string" ||
    !value.from ||
    typeof value.body !== "string" ||
    (value.to !== undefined && typeof value.to !== "string") ||
    (value.media !== undefined && !Array.isArray(value.media))
  ) {
    return null;
  }

  const media = Array.isArray(value.media)
    ? value.media.flatMap((item) => {
        if (
          !isRecord(item) ||
          typeof item.url !== "string" ||
          !item.url ||
          (item.mimeType !== undefined && typeof item.mimeType !== "string")
        ) {
          return [];
        }

        return [
          {
            url: item.url,
            ...(typeof item.mimeType === "string" ? { mimeType: item.mimeType } : {}),
          },
        ];
      })
    : undefined;

  return {
    messageId: value.messageId,
    from: value.from,
    body: value.body,
    ...(typeof value.to === "string" ? { to: value.to } : {}),
    ...(media?.length ? { media } : {}),
  };
}

export function parseInboundChannelTaskData(value: unknown): InboundChannelTaskData | null {
  if (!isRecord(value) || !isInboundChannelId(value.channel)) {
    return null;
  }

  const message = parseInboundMessage(value.message);

  if (!message) {
    return null;
  }

  if (typeof value.bindingId === "string" && value.bindingId.length > 0) {
    return { channel: value.channel, message, bindingId: value.bindingId };
  }

  if (
    isMessagingProviderId(value.providerId) &&
    typeof value.providerSettingsId === "string" &&
    value.providerSettingsId
  ) {
    return {
      channel: value.channel,
      message,
      providerId: value.providerId,
      providerSettingsId: value.providerSettingsId,
    };
  }

  return null;
}

export function toChannelBindingMessage(incoming: ChannelIncomingMessage): InboundChannelMessage {
  return {
    messageId: incoming.messageId,
    from: incoming.from,
    body: incoming.body,
    ...(incoming.media?.length ? { media: incoming.media } : {}),
  };
}

export function toInboundChannelMessage(incoming: IncomingMessage): InboundChannelMessage {
  return {
    messageId: incoming.messageId,
    from: incoming.from,
    ...(incoming.to ? { to: incoming.to } : {}),
    body: incoming.body,
    ...(incoming.media?.length ? { media: incoming.media } : {}),
  };
}

async function buildChannelConversationId(prefix: string, parts: string[]): Promise<string> {
  const digest = await sha256Hex([prefix, ...parts].join(":"));

  return `${prefix}_${digest.slice(0, 40)}`;
}

export async function getInboundChannelConversationId(params: {
  channel: InboundChannelId;
  userId: number;
  providerSettingsId: string;
  from: string;
  to?: string;
}): Promise<string> {
  const profile = getInboundChannelProfile(params.channel);

  return buildChannelConversationId(profile.conversationPrefix, [
    params.userId.toString(),
    params.providerSettingsId,
    normaliseMessagingAddress(params.from),
    normaliseMessagingAddress(params.to ?? ""),
  ]);
}

export async function getChannelBindingConversationId(params: {
  channel: InboundChannelId;
  bindingId: string;
  externalId: string;
}): Promise<string> {
  const profile = getInboundChannelProfile(params.channel);

  return buildChannelConversationId(profile.conversationPrefix, [
    params.bindingId,
    normaliseMessagingAddress(params.externalId),
  ]);
}

async function getActiveChannelMessages(params: {
  context: ServiceContext;
  user: IUser;
  conversationId: string;
  historyLimit: number;
}): Promise<Message[]> {
  const conversationManager = ConversationManager.getInstance({
    database: params.context.database,
    repositories: params.context.repositories,
    user: params.user,
    env: params.context.env,
    store: true,
    requestCache: params.context.requestCache,
  });

  let messages: Message[];

  try {
    messages = await conversationManager.get(params.conversationId);
  } catch (error) {
    if (error instanceof AssistantError && error.type === ErrorType.NOT_FOUND) {
      return [];
    }

    throw error;
  }

  const priorMessageLimit = params.historyLimit - 1;
  const archiveCount = Math.max(messages.length - priorMessageLimit, 0);

  if (archiveCount > 0) {
    const archiveIds = messages
      .slice(0, archiveCount)
      .flatMap((message) => (message.id ? [message.id] : []));

    await conversationManager.archiveMessages(params.conversationId, archiveIds);
  }

  return messages.slice(-priorMessageLimit);
}

async function resolveProviderReplyMediaUrls(params: {
  context: ServiceContext;
  userId: number;
  providerId: MessagingProviderId;
  providerSettingsId: string;
  mediaUrls: string[];
}): Promise<string[] | undefined> {
  if (params.mediaUrls.length === 0) {
    return undefined;
  }

  const settings = await params.context.repositories.userSettings.getUserProviderSettings(
    params.userId,
  );
  const currentProviderSettings = settings.find(
    (setting) =>
      setting.id === params.providerSettingsId && setting.provider_id === params.providerId,
  );

  if (!currentProviderSettings) {
    return undefined;
  }

  const delivery = selectConfiguredMessagingDelivery([currentProviderSettings], {
    mediaUrls: params.mediaUrls,
    apiBaseUrl: params.context.env.API_BASE_URL,
  });

  return delivery?.mediaUrls;
}

async function resolveInboundChannelProvider(params: {
  env: IEnv;
  context: ServiceContext;
  user: IUser;
  providerId: MessagingProviderId;
  providerSettingsId: string;
}): Promise<{ provider: MessagingProvider; allowedSenders: string[] }> {
  const encryptedValue =
    await params.context.repositories.userSettings.getProviderApiKeyForSettings({
      userId: params.user.id,
      providerId: params.providerId,
      providerSettingsId: params.providerSettingsId,
    });

  if (!encryptedValue) {
    throw new AssistantError(
      "Messaging provider credentials are not configured",
      ErrorType.NOT_FOUND,
    );
  }

  return resolveStoredMessagingProvider({
    providerId: params.providerId,
    value: encryptedValue,
    env: params.env,
    user: params.user,
    context: params.context,
  });
}

interface ChannelReplyPayload {
  body: string;
  mediaUrls: string[];
}

type ChannelDelivery =
  | { status: "unauthorised_sender" }
  | { status: "channel_unavailable" }
  | {
      status: "ready";
      conversationId: string;
      teammateId?: string;
      projectId?: string;
      bindingId?: string;
      teammateContextId?: string;
      send(reply: ChannelReplyPayload): Promise<void>;
    };

async function resolveProviderDelivery(params: {
  env: IEnv;
  context: ServiceContext;
  user: IUser;
  data: InboundProviderTaskData;
}): Promise<ChannelDelivery> {
  const { message, providerId, providerSettingsId } = params.data;
  const { provider, allowedSenders } = await resolveInboundChannelProvider({
    env: params.env,
    context: params.context,
    user: params.user,
    providerId,
    providerSettingsId,
  });

  if (!isAuthorisedSender(allowedSenders, message.from)) {
    return { status: "unauthorised_sender" };
  }

  const conversationId = await getInboundChannelConversationId({
    channel: params.data.channel,
    userId: params.user.id,
    providerSettingsId,
    from: message.from,
    to: message.to,
  });

  return {
    status: "ready",
    conversationId,
    send: async (reply) => {
      const replyMediaUrls = await resolveProviderReplyMediaUrls({
        context: params.context,
        userId: params.user.id,
        providerId,
        providerSettingsId,
        mediaUrls: reply.mediaUrls,
      });

      await provider.send({
        to: message.from,
        body: reply.body,
        ...(replyMediaUrls?.length ? { mediaUrls: replyMediaUrls } : {}),
      });
    },
  };
}

async function resolveBindingDelivery(params: {
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
    binding.created_by !== params.user.id
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
    externalId: binding.external_id,
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

  return {
    status: "ready",
    conversationId,
    ...(binding.teammate_id ? { teammateId: binding.teammate_id } : {}),
    ...(teammateContext ? { teammateContextId: teammateContext.id } : {}),
    bindingId: binding.id,
    ...(binding.scope_type === "project" ? { projectId: binding.scope_id } : {}),
    send: async (reply) => {
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
        current.interaction_mode !== binding.interaction_mode
      ) {
        throw new AssistantError(
          "Channel binding changed before delivery",
          ErrorType.FORBIDDEN,
          403,
        );
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
            "Teammate context changed before delivery",
            ErrorType.FORBIDDEN,
            403,
          );
        }
      }

      await adapter.sendReply({ externalId: current.external_id, body: reply.body }, replySecret);
    },
  };
}

export type InboundChannelResult =
  | { status: "delivered"; conversationId: string; body: string }
  | { status: "unauthorised_sender" }
  | { status: "channel_unavailable" };

export async function handleInboundChannelMessage(params: {
  env: IEnv;
  context: ServiceContext;
  user: IUser;
  data: InboundChannelTaskData;
}): Promise<InboundChannelResult> {
  const profile = getInboundChannelProfile(params.data.channel);
  const { message } = params.data;
  const delivery = isInboundBindingTaskData(params.data)
    ? await resolveBindingDelivery({ ...params, data: params.data })
    : await resolveProviderDelivery({ ...params, data: params.data });

  if (delivery.status !== "ready") {
    return delivery;
  }

  const { conversationId } = delivery;
  const commandDigest = await sha256Hex(
    [params.data.channel, conversationId, message.messageId].join(":"),
  );
  const commandId = `channel_message_${commandDigest.slice(0, 40)}`;
  const existing = await params.context.repositories.conversationRuns.getCommandReceipt(
    params.user.id,
    commandId,
  );
  let completion;

  if (existing?.run.conversationId === conversationId) {
    const recovery = await recoverChatCompletionResponse(params.context, existing);

    if (recovery.state === "in_progress") {
      throw new AssistantError(
        "The accepted channel response is still running",
        ErrorType.CONFLICT_ERROR,
        409,
      );
    }

    completion = recovery.response;
  } else {
    const activeMessages = await getActiveChannelMessages({
      context: params.context,
      user: params.user,
      conversationId,
      historyLimit: profile.historyLimit,
    });
    const request = createChatCompletionsJsonSchema.parse({
      completion_id: conversationId,
      command_id: commandId,
      stream: false,
      store: true,
      mode: "agent",
      trigger: "channel",
      max_steps: profile.maxSteps,
      enabled_tools: profile.tools,
      tool_choice: "auto",
      ...(delivery.projectId ? { metadata: { project_id: delivery.projectId } } : {}),
      messages: [
        ...activeMessages,
        {
          role: "user",
          content: buildInboundMessageContent({
            body: message.body,
            media: message.media,
          }),
        },
      ],
      options: {
        channel: {
          id: profile.id,
          ...(message.from ? { from: message.from } : {}),
          ...(message.to ? { to: message.to } : {}),
        },
      },
    });

    completion = delivery.teammateId
      ? await enqueueTeammateRun({
          env: params.env,
          context: params.context,
          body: request,
          teammateId: delivery.teammateId,
          user: params.user,
          anonymousUser: undefined,
          trigger: "channel",
          invocation: delivery.bindingId
            ? {
                source: "channel",
                bindingId: delivery.bindingId,
                messageId: message.messageId,
              }
            : undefined,
        })
      : await handleCreateChatCompletions({
          env: params.env,
          context: params.context,
          user: params.user,
          request,
        });
  }

  const notification = extractChatCompletionNotification(completion, {
    streamingMessage: `${profile.label} assistant responses cannot be streamed`,
  });

  await deliverOutboundOperation({
    context: params.context,
    deliveryId: `channel_reply_${commandDigest.slice(0, 40)}`,
    userId: params.user.id,
    kind: "channel_reply",
    scopeId: conversationId,
    operationId: message.messageId,
    payload: {
      destination: message.from,
      body: notification.body,
      mediaUrls: notification.mediaUrls,
    },
    send: () => delivery.send({ body: notification.body, mediaUrls: notification.mediaUrls }),
  });

  return { status: "delivered", conversationId, body: notification.body };
}
