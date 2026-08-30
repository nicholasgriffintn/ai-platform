import { normalizeMessage } from "@ngriffin_uk/polychat-library-chat/messages";
import type { LockedMessage, SealedEnvelope } from "@ngriffin_uk/polychat-schemas";

import { apiService } from "~/lib/api/api-service";
import {
  openMessage,
  openTitle,
  sealMessage,
  sealTitle,
  type LockedMessagePayload,
} from "~/lib/crypto/conversation-lock";
import type { Message } from "~/types";

/** Roles that survive the round trip. Everything else is a server-side concept. */
const SEALABLE_ROLES = new Set(["user", "assistant"]);

function messageText(message: Message): string {
  if (typeof message.content === "string") {
    return message.content;
  }

  if (Array.isArray(message.content)) {
    return message.content
      .map((part) => (typeof part === "string" ? part : ((part as { text?: string }).text ?? "")))
      .join("");
  }

  return "";
}

export function isSealableMessage(message: Message): boolean {
  return SEALABLE_ROLES.has(message.role) && Boolean(message.id);
}

function toAppMessage(
  conversationId: string,
  decrypted: Awaited<ReturnType<typeof openMessage>>,
): Message {
  return normalizeMessage({
    id: decrypted.id,
    role: decrypted.role,
    content: decrypted.content,
    model: decrypted.model ?? undefined,
    timestamp: decrypted.timestamp,
    created: decrypted.timestamp,
    completion_id: conversationId,
    ...(decrypted.reasoning
      ? { reasoning: { collapsed: true, content: decrypted.reasoning } }
      : {}),
  });
}

export async function decryptLockedMessages(params: {
  conversationId: string;
  conversationKey: CryptoKey;
  messages: LockedMessage[];
}): Promise<Message[]> {
  const { conversationId, conversationKey, messages } = params;

  return Promise.all(
    messages.map(async (message) =>
      toAppMessage(conversationId, await openMessage({ conversationId, conversationKey, message })),
    ),
  );
}

export async function loadLockedConversationMessages(params: {
  conversationId: string;
  conversationKey: CryptoKey;
}): Promise<Message[]> {
  const messages = await apiService.conversationLocks.listMessages(params.conversationId);

  return decryptLockedMessages({ ...params, messages });
}

export async function sealConversationMessages(params: {
  conversationId: string;
  conversationKey: CryptoKey;
  messages: Message[];
  startSeq?: number;
}) {
  const { conversationId, conversationKey, messages, startSeq = 0 } = params;

  return Promise.all(
    messages.filter(isSealableMessage).map((message, index) => {
      const payload: LockedMessagePayload = {
        content: messageText(message),
        model: message.model ?? null,
        reasoning: message.reasoning?.content ?? null,
        timestamp: message.timestamp ?? message.created,
      };

      return sealMessage({
        conversationId,
        conversationKey,
        id: message.id as string,
        seq: startSeq + index,
        role: message.role as "user" | "assistant",
        payload,
      });
    }),
  );
}

/**
 * The whole thread is resealed on every write. Envelopes are small, the cap keeps the
 * thread short, and one write path is far easier to reason about than incremental
 * sequence bookkeeping across retries, edits, and branches.
 */
export async function persistLockedConversation(params: {
  conversationId: string;
  conversationKey: CryptoKey;
  messages: Message[];
  title?: string | null;
}): Promise<void> {
  const { conversationId, conversationKey, messages, title } = params;
  const sealed = await sealConversationMessages({
    conversationId,
    conversationKey,
    messages,
  });

  if (sealed.length === 0) {
    return;
  }

  const titleEnvelope: SealedEnvelope | null | undefined =
    title === undefined
      ? undefined
      : title === null
        ? null
        : await sealTitle(conversationId, conversationKey, title);

  await apiService.conversationLocks.appendMessages(conversationId, sealed, titleEnvelope);
}

export async function decryptLockedTitle(params: {
  conversationId: string;
  conversationKey: CryptoKey;
  envelope: SealedEnvelope | null;
}): Promise<string | null> {
  if (!params.envelope) {
    return null;
  }

  try {
    return await openTitle(params.conversationId, params.conversationKey, params.envelope);
  } catch {
    return null;
  }
}
