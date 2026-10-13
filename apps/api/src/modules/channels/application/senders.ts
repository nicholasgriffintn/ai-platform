import type { ChannelPairingChallenge, ChannelSender } from "@ngriffin_uk/polychat-schemas";
import { sha256Hex, toHex } from "@ngriffin_uk/polychat-utility-server/crypto";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";

import { requireChannelBindingAccess } from "./access";
import type { ChannelIncomingMessage } from "./ports/channel-adapter";
import { publishChannelSendersChanged } from "./sender-events";

export async function issueChannelPairingChallenge(
  context: ServiceContext,
  bindingId: string,
): Promise<ChannelPairingChallenge> {
  await requireChannelBindingAccess(context, bindingId);
  const user = context.requireUser();
  const token = toHex(crypto.getRandomValues(new Uint8Array(32)).buffer);
  const expiresAt = new Date(Date.now() + 10 * 60_000).toISOString();

  if (
    !(await context.repositories.channelSenders.issueChallenge(
      bindingId,
      user.id,
      await sha256Hex(token),
      expiresAt,
    ))
  ) {
    throw new AssistantError("Channel changed before linking", ErrorType.CONFLICT_ERROR, 409);
  }

  return { command: `/polychat-link ${token}`, expiresAt };
}

export async function consumeChannelPairingCommand(
  context: ServiceContext,
  incoming: ChannelIncomingMessage,
): Promise<boolean | null> {
  const body = incoming.body.trim();

  if (!body.startsWith("/polychat-link")) {
    return null;
  }

  const match = /^\/polychat-link ([a-f0-9]{64})$/.exec(body);

  if (!match) {
    return false;
  }

  const tokenHash = await sha256Hex(match[1]);

  if (!incoming.context.isDirect) {
    await context.repositories.channelSenders.discardChallenge(tokenHash);

    return false;
  }

  const binding = await context.repositories.channelSenders.challengeBinding(tokenHash);

  if (
    !binding ||
    (binding.channel === "slack"
      ? binding.external_id.split(":")[0] !== incoming.from.split(":")[0]
      : binding.external_id !== incoming.externalId)
  ) {
    return false;
  }

  const sender = await context.repositories.channelSenders.consumeChallenge(
    binding.id,
    incoming.from,
    true,
    tokenHash,
  );

  if (sender) {
    await publishChannelSendersChanged(context, binding);
  }

  return Boolean(sender);
}

export async function listChannelSenders(
  context: ServiceContext,
  bindingId: string,
): Promise<{ senders: ChannelSender[] }> {
  const { canManage } = await requireChannelBindingAccess(context, bindingId);
  const user = context.requireUser();
  const rows = await context.repositories.channelSenders.list(bindingId, user.id, canManage);

  return {
    senders: rows.map((row) => ({
      id: row.id,
      senderId: row.sender_id,
      userId: row.user_id,
      revision: row.revision,
      revokedAt: row.revoked_at,
      createdAt: row.created_at,
      canRevoke: canManage || row.user_id === user.id,
    })),
  };
}

export async function revokeChannelSender(
  context: ServiceContext,
  bindingId: string,
  senderId: string,
  expectedRevision: number,
): Promise<void> {
  const { binding } = await requireChannelBindingAccess(context, bindingId);

  if (
    !(await context.repositories.channelSenders.revoke(
      bindingId,
      senderId,
      expectedRevision,
      context.requireUser().id,
    ))
  ) {
    throw new AssistantError("Sender changed or cannot be revoked", ErrorType.CONFLICT_ERROR, 409);
  }

  await publishChannelSendersChanged(context, binding);
}
