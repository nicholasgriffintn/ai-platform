import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import { isPolyTeammateId } from "@ngriffin_uk/polychat-schemas";
import { sha256Hex } from "@ngriffin_uk/polychat-utility-server/crypto";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { deliverWithChannelDisclosure } from "~/modules/channels/application/disclosed-reply";
import { CHANNEL_TOP_LEVEL_THREAD } from "~/modules/channels/application/ports/channel-adapter";
import { getChannelAdapter } from "~/modules/channels/infrastructure/adapters";
import { ChannelBindingRepository } from "~/modules/channels/infrastructure/ChannelBindingRepository";
import type { IUser } from "~/types";

const logger = getLogger({ prefix: "services/poly/channel-delivery" });

const CHANNEL_BODY_LIMIT = 1_200;

export async function sendPolyNotificationToChannels(params: {
  context: ServiceContext;
  user: IUser;
  polyContextId: string;
  notificationId: string;
  body: string;
}): Promise<void> {
  const bindings = await params.context.repositories
    .get(ChannelBindingRepository)
    .listForUser(params.user.id);
  const polyBindings = bindings.filter(
    (binding) =>
      binding.enabled &&
      isPolyTeammateId(binding.teammate_id) &&
      binding.scope_type === "personal" &&
      binding.scope_id === String(params.user.id) &&
      binding.created_by === params.user.id,
  );
  const body = params.body.slice(0, CHANNEL_BODY_LIMIT);

  for (const binding of polyBindings) {
    const adapter = getChannelAdapter(binding.channel);

    if (!adapter?.isReplyConfigured(params.context.env)) {
      continue;
    }

    const digest = await sha256Hex(`${params.notificationId}:${binding.id}`);

    try {
      await deliverWithChannelDisclosure({
        context: params.context,
        contact: { channel: binding.channel, bindingId: binding.id },
        deliveryId: `poly_notification_${digest.slice(0, 40)}`,
        userId: params.user.id,
        kind: "poly_notification",
        scopeId: params.polyContextId,
        operationId: params.notificationId,
        body,
        payload: { bindingId: binding.id, body },
        send: (disclosedBody) =>
          adapter.sendReply(
            {
              externalId: binding.external_id,
              body: disclosedBody,
              threadId: CHANNEL_TOP_LEVEL_THREAD,
            },
            params.context.env,
          ),
      });
    } catch (error) {
      logger.warn("Poly could not reach a bound channel", {
        bindingId: binding.id,
        channel: binding.channel,
        error,
      });
    }
  }
}
