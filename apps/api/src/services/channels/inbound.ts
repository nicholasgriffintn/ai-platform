import { INBOUND_CHANNEL_IDS, type InboundChannelId } from "@ngriffin_uk/polychat-schemas";

import { getInboundChannelProfile } from "~/lib/chat/policy/channels";
import type { ServiceContext } from "~/lib/context/serviceContext";
import { ConversationManager } from "~/lib/conversationManager";
import {
  isAuthorisedSender,
  normaliseMessagingAddress,
  type IncomingMessage,
  type MessagingProvider,
  type MessagingProviderId,
} from "~/lib/providers/capabilities/messaging";
import {
  resolveStoredMessagingProvider,
  selectConfiguredMessagingDelivery,
} from "~/lib/providers/capabilities/messaging/delivery";
import { handleCreateChatCompletions } from "~/services/completions/createChatCompletions";
import type { IEnv, IUser, Message } from "~/types";
import { sha256Hex } from "~/utils/crypto";
import { AssistantError, ErrorType } from "~/utils/errors";
import { buildInboundMessageContent, extractChatCompletionNotification } from "~/utils/messages";

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
  return typeof (data as InboundBindingTaskData).bindingId === "string";
}

export function parseInboundChannelTaskData(value: unknown): InboundChannelTaskData | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const data = value as Partial<InboundProviderTaskData & InboundBindingTaskData>;

  if (!data.channel || !INBOUND_CHANNEL_IDS.includes(data.channel)) {
    return null;
  }

  if (!data.message?.from || !data.message.messageId) {
    return null;
  }

  if (typeof data.bindingId === "string" && data.bindingId.length > 0) {
    return { channel: data.channel, message: data.message, bindingId: data.bindingId };
  }

  if (data.providerId && data.providerSettingsId) {
    return {
      channel: data.channel,
      message: data.message,
      providerId: data.providerId,
      providerSettingsId: data.providerSettingsId,
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

  return {
    status: "ready",
    conversationId,
    send: async (reply) =>
      adapter.sendReply({ externalId: binding.external_id, body: reply.body }, replySecret),
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
  const activeMessages = await getActiveChannelMessages({
    context: params.context,
    user: params.user,
    conversationId,
    historyLimit: profile.historyLimit,
  });
  const completion = await handleCreateChatCompletions({
    env: params.env,
    context: params.context,
    user: params.user,
    request: {
      completion_id: conversationId,
      stream: false,
      store: true,
      mode: "agent",
      max_steps: profile.maxSteps,
      enabled_tools: profile.tools,
      approved_tools: profile.tools,
      tool_choice: "auto",
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
    },
  });
  const notification = extractChatCompletionNotification(completion, {
    streamingMessage: `${profile.label} assistant responses cannot be streamed`,
  });

  await delivery.send({ body: notification.body, mediaUrls: notification.mediaUrls });

  return { status: "delivered", conversationId, body: notification.body };
}
