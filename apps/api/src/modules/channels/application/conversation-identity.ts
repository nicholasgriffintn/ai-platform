import type { InboundChannelId, ChannelThreadReference } from "@ngriffin_uk/polychat-schemas";
import { canonicalJson } from "@ngriffin_uk/polychat-utility-core";
import { sha256Hex } from "@ngriffin_uk/polychat-utility-server/crypto";

import { normaliseMessagingAddress } from "~/infrastructure/providers/capabilities/messaging";
import { getInboundChannelProfile } from "~/modules/chat/domain/channels";

export async function getInboundChannelConversationId(params: {
  channel: InboundChannelId;
  userId: number;
  providerSettingsId: string;
  from: string;
  to?: string;
}): Promise<string> {
  const prefix = getInboundChannelProfile(params.channel).conversationPrefix;
  const digest = await sha256Hex(
    [
      prefix,
      params.userId.toString(),
      params.providerSettingsId,
      normaliseMessagingAddress(params.from),
      normaliseMessagingAddress(params.to ?? ""),
    ].join(":"),
  );

  return `${prefix}_${digest.slice(0, 40)}`;
}

export async function getChannelBindingConversationId(params: {
  channel: InboundChannelId;
  bindingId: string;
  thread: Pick<ChannelThreadReference, "workspaceId" | "externalId" | "threadId">;
}): Promise<string> {
  const prefix = getInboundChannelProfile(params.channel).conversationPrefix;
  const digest = await sha256Hex(
    canonicalJson([
      prefix,
      params.bindingId,
      params.thread.workspaceId,
      params.thread.externalId,
      params.thread.threadId,
    ]),
  );

  return `${prefix}_${digest.slice(0, 40)}`;
}
