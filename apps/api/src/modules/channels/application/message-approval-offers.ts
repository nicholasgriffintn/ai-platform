import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import type { ChatRun, InboundChannelId, TeammateContext } from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import type { ChannelBindingRow } from "~/infrastructure/database/schema";
import { isAuthorisedSender } from "~/infrastructure/providers/capabilities/messaging";
import {
  resolveStoredMessagingProvider,
  selectConfiguredMessagingDelivery,
} from "~/infrastructure/providers/capabilities/messaging/delivery";
import { CHANNEL_TOP_LEVEL_THREAD } from "~/modules/channels/application/ports/channel-adapter";
import { getChannelAdapter } from "~/modules/channels/infrastructure/adapters";
import { ChannelBindingRepository } from "~/modules/channels/infrastructure/ChannelBindingRepository";
import { ChannelSenderRepository } from "~/modules/channels/infrastructure/ChannelSenderRepository";
import { deliverOutboundOperation } from "~/modules/delivery/application/outbound";
import { UserSettingsRepository } from "~/modules/user/infrastructure/UserSettingsRepository";
import type { IUser } from "~/types";

import {
  bindingApprovalSenderKey,
  issueMessageApproval,
  providerApprovalSenderKey,
} from "./message-approvals";

const logger = getLogger({ prefix: "services/channels/message-approval-offers" });

const APPROVAL_CHANNELS: ReadonlySet<InboundChannelId> = new Set(["slack", "telegram"]);

function bindingServesContext(binding: ChannelBindingRow, teammateContext: TeammateContext) {
  return (
    binding.enabled &&
    binding.teammate_id === teammateContext.teammateId &&
    APPROVAL_CHANNELS.has(binding.channel) &&
    binding.scope_type === teammateContext.scope.type &&
    binding.scope_id === teammateContext.scope.id
  );
}

async function offerOverBinding(params: {
  context: ServiceContext;
  user: IUser;
  run: ChatRun;
  binding: ChannelBindingRow;
}): Promise<void> {
  const { context, user, run, binding } = params;
  const adapter = getChannelAdapter(binding.channel);

  if (!adapter?.isReplyConfigured(context.env)) {
    return;
  }

  const senders = await context.repositories
    .get(ChannelSenderRepository)
    .list(binding.id, user.id, false);

  for (const sender of senders) {
    if (sender.revoked_at || sender.user_id !== user.id) {
      continue;
    }

    const issued = await issueMessageApproval({
      context,
      user,
      run,
      sender: {
        channel: binding.channel,
        senderKey: await bindingApprovalSenderKey({
          bindingId: binding.id,
          mappingId: sender.id,
          revision: sender.revision,
        }),
      },
    });

    if (!issued) {
      continue;
    }

    await deliverOutboundOperation({
      context,
      deliveryId: `message_approval_${issued.id}`,
      userId: user.id,
      kind: "message_approval",
      scopeId: run.conversationId,
      operationId: issued.id,
      payload: { approvalId: issued.id, bindingId: binding.id },
      send: () =>
        adapter.sendReply(
          {
            externalId: binding.external_id,
            body: issued.body,
            threadId: CHANNEL_TOP_LEVEL_THREAD,
          },
          context.env,
        ),
    });
  }
}

async function offerOverSms(params: {
  context: ServiceContext;
  user: IUser;
  run: ChatRun;
  target: string;
}): Promise<void> {
  const { context, user, run, target } = params;
  const settings = context.repositories.get(UserSettingsRepository);
  const delivery = selectConfiguredMessagingDelivery(
    await settings.getUserProviderSettings(user.id),
  );
  const encryptedValue = delivery
    ? await settings.getProviderApiKeyForSettings({
        userId: user.id,
        providerId: delivery.providerId,
        providerSettingsId: delivery.id,
      })
    : null;

  if (!delivery || !encryptedValue) {
    return;
  }

  const { provider, allowedSenders } = resolveStoredMessagingProvider({
    providerId: delivery.providerId,
    value: encryptedValue,
    env: context.env,
    user,
    context,
  });

  if (!isAuthorisedSender(allowedSenders, target)) {
    return;
  }

  const issued = await issueMessageApproval({
    context,
    user,
    run,
    sender: {
      channel: "sms",
      senderKey: await providerApprovalSenderKey({
        providerSettingsId: delivery.id,
        address: target,
      }),
    },
  });

  if (!issued) {
    return;
  }

  await deliverOutboundOperation({
    context,
    deliveryId: `message_approval_${issued.id}`,
    userId: user.id,
    kind: "message_approval",
    scopeId: run.conversationId,
    operationId: issued.id,
    payload: { approvalId: issued.id, providerSettingsId: delivery.id },
    send: () => provider.send({ to: target, body: issued.body }),
  });
}

export async function offerRunApprovalByMessage(params: {
  context: ServiceContext;
  user: IUser;
  teammateContext: TeammateContext;
  run: ChatRun;
  smsTarget?: string;
}): Promise<void> {
  const { context, user, teammateContext, run, smsTarget } = params;
  const bindings = await context.repositories.get(ChannelBindingRepository).listForUser(user.id);

  for (const binding of bindings) {
    if (!bindingServesContext(binding, teammateContext)) {
      continue;
    }

    try {
      await offerOverBinding({ context, user, run, binding });
    } catch (error) {
      logger.warn("Could not offer an approval on a bound channel", {
        bindingId: binding.id,
        channel: binding.channel,
        error,
      });
    }
  }

  if (!smsTarget) {
    return;
  }

  try {
    await offerOverSms({ context, user, run, target: smsTarget });
  } catch (error) {
    logger.warn("Could not offer an approval by SMS", { runId: run.id, error });
  }
}
