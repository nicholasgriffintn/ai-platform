import { channelSenderIdsSchema, type ChannelThreadReference } from "@ngriffin_uk/polychat-schemas";
import { safeParseJson } from "@ngriffin_uk/polychat-utility-server/json";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import type { ChannelBindingRow } from "~/infrastructure/database/schema";

export function isChannelSenderAllowed(binding: ChannelBindingRow, senderId: string): boolean {
  const ids = channelSenderIdsSchema.safeParse(safeParseJson<unknown>(binding.allowed_sender_ids));

  return ids.success && ids.data.includes(senderId);
}

export async function isChannelThreadCurrent(
  context: ServiceContext,
  binding: ChannelBindingRow,
  reference: ChannelThreadReference,
  senderId: string,
): Promise<boolean> {
  if (
    !binding.enabled ||
    binding.revision !== reference.bindingRevision ||
    binding.workspace_id !== reference.workspaceId ||
    binding.external_id !== reference.externalId ||
    !isChannelSenderAllowed(binding, senderId)
  ) {
    return false;
  }

  const thread = await context.repositories.channelThreads.get(binding.id, reference.threadId);

  return thread !== null && !thread.muted && thread.revision === reference.revision;
}
