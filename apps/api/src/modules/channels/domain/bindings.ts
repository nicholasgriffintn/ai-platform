import { channelBindingSchema, type ChannelBinding } from "@ngriffin_uk/polychat-schemas";
import { safeParseJson } from "@ngriffin_uk/polychat-utility-server/json";

import type { ChannelBindingRow, ChannelThreadRow } from "~/infrastructure/database/schema";

export function toChannelBinding(row: ChannelBindingRow): ChannelBinding {
  return channelBindingSchema.parse({
    id: row.id,
    revision: row.revision,
    channel: row.channel,
    scopeType: row.scope_type,
    scopeId: row.scope_id,
    externalId: row.external_id,
    workspaceId: row.workspace_id,
    allowedSenderIds: safeParseJson<unknown>(row.allowed_sender_ids),
    replyMode: row.reply_mode,
    label: row.label,
    teammateId: row.teammate_id,
    interactionMode: row.interaction_mode,
    enabled: Number(row.enabled) === 1,
    createdAt: row.created_at,
  });
}

export function toChannelBindingRow(row: ChannelBindingRow): ChannelBindingRow {
  return { ...row, enabled: Number(row.enabled) === 1 };
}

export function toChannelThreadRow(row: ChannelThreadRow): ChannelThreadRow {
  return { ...row, muted: Number(row.muted) === 1 };
}
