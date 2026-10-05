import type { InboundProviderTaskData } from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import {
  isAuthorisedSender,
  type MessagingProvider,
  type MessagingProviderId,
} from "~/infrastructure/providers/capabilities/messaging";
import {
  resolveStoredMessagingProvider,
  selectConfiguredMessagingDelivery,
} from "~/infrastructure/providers/capabilities/messaging/delivery";
import type { IEnv, IUser } from "~/types";

import { getInboundChannelConversationId } from "./conversation-identity";
import type { ChannelDelivery } from "./delivery-types";

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

export async function resolveProviderDelivery(params: {
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
    interactionMode: "direct",
    validate: async () => undefined,
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
