import { conversationHandleSchema, type ConversationHandle } from "@ngriffin_uk/polychat-schemas";

import type { ConversationHandleRow } from "~/lib/database/schema";

export function formatConversationHandle(row: ConversationHandleRow): ConversationHandle {
  return conversationHandleSchema.parse({
    id: row.id,
    conversationId: row.conversation_id,
    grantedTo: { kind: "delegation", delegationId: row.delegation_id },
    grantedBy: row.granted_by,
    grantedAt: row.granted_at,
    expiresAt: row.expires_at,
    revokedAt: row.revoked_at,
  });
}

export function conversationHandleIdForDelegation(delegationId: string): string {
  return `handle_${delegationId}`;
}
