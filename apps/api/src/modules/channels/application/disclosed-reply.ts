import { AI_DISCLOSURE_TEXT, type InboundChannelId } from "@ngriffin_uk/polychat-schemas";
import { canonicalJson } from "@ngriffin_uk/polychat-utility-core";
import { sha256Hex } from "@ngriffin_uk/polychat-utility-server/crypto";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { normaliseMessagingAddress } from "~/infrastructure/providers/capabilities/messaging";
import { deliverOutboundOperation } from "~/modules/delivery/application/outbound";
import { OutboundDeliveryRepository } from "~/modules/delivery/infrastructure/OutboundDeliveryRepository";

export async function deliverDisclosedChannelReply(params: {
  context: ServiceContext;
  userId: number;
  channel: InboundChannelId;
  conversationId: string;
  from: string;
  messageId: string;
  deliveryId: string;
  body: string;
  payload: Record<string, unknown>;
  send(body: string): Promise<void>;
}): Promise<void> {
  const repository = params.context.repositories.get(OutboundDeliveryRepository);
  const disclosure = {
    channel: params.channel,
    conversationId: params.conversationId,
    from: normaliseMessagingAddress(params.from),
  };
  const digest = await sha256Hex(canonicalJson(disclosure));
  const disclosureId = `channel_disclosure_${digest.slice(0, 40)}`;
  const disclosed = await repository.isSent(disclosureId, params.userId);

  await deliverOutboundOperation({
    context: params.context,
    deliveryId: params.deliveryId,
    userId: params.userId,
    kind: "channel_reply",
    scopeId: params.conversationId,
    operationId: params.messageId,
    payload: params.payload,
    send: () => params.send(disclosed ? params.body : `${AI_DISCLOSURE_TEXT}\n\n${params.body}`),
  });

  if (!disclosed) {
    await repository.recordSent({
      id: disclosureId,
      userId: params.userId,
      kind: "channel_disclosure",
      scopeId: params.conversationId,
      operationId: params.messageId,
      payloadDigest: digest,
      payload: disclosure,
    });
  }
}
