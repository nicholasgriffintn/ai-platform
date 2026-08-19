import type { InboundChannelId } from "@ngriffin_uk/polychat-schemas";

import { getInboundChannelProfile } from "~/lib/chat/channels";
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

export interface InboundChannelMessage {
  messageId: string;
  from: string;
  to?: string;
  body: string;
  media?: { url: string; mimeType?: string }[];
}

export interface InboundChannelTaskData {
  channel: InboundChannelId;
  providerId: MessagingProviderId;
  providerSettingsId: string;
  message: InboundChannelMessage;
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

export async function getInboundChannelConversationId(params: {
  channel: InboundChannelId;
  userId: number;
  providerSettingsId: string;
  from: string;
  to?: string;
}): Promise<string> {
  const profile = getInboundChannelProfile(params.channel);
  const digest = await sha256Hex(
    [
      profile.conversationPrefix,
      params.userId.toString(),
      params.providerSettingsId,
      normaliseMessagingAddress(params.from),
      normaliseMessagingAddress(params.to ?? ""),
    ].join(":"),
  );

  return `${profile.conversationPrefix}_${digest.slice(0, 40)}`;
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

export type InboundChannelResult =
  | { status: "delivered"; conversationId: string; body: string }
  | { status: "unauthorised_sender" };

export async function handleInboundChannelMessage(params: {
  env: IEnv;
  context: ServiceContext;
  user: IUser;
  data: InboundChannelTaskData;
}): Promise<InboundChannelResult> {
  const profile = getInboundChannelProfile(params.data.channel);
  const { message } = params.data;
  const { provider, allowedSenders } = await resolveInboundChannelProvider({
    env: params.env,
    context: params.context,
    user: params.user,
    providerId: params.data.providerId,
    providerSettingsId: params.data.providerSettingsId,
  });

  if (!isAuthorisedSender(allowedSenders, message.from)) {
    return { status: "unauthorised_sender" };
  }

  const conversationId = await getInboundChannelConversationId({
    channel: params.data.channel,
    userId: params.user.id,
    providerSettingsId: params.data.providerSettingsId,
    from: message.from,
    to: message.to,
  });
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
      model: profile.model,
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
  const replyMediaUrls = await resolveProviderReplyMediaUrls({
    context: params.context,
    userId: params.user.id,
    providerId: params.data.providerId,
    providerSettingsId: params.data.providerSettingsId,
    mediaUrls: notification.mediaUrls,
  });

  await provider.send({
    to: message.from,
    body: notification.body,
    ...(replyMediaUrls?.length ? { mediaUrls: replyMediaUrls } : {}),
  });

  return { status: "delivered", conversationId, body: notification.body };
}
