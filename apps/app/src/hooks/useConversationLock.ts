import { CONVERSATION_LOCK_VERSION, type ConversationLock } from "@ngriffin_uk/polychat-schemas";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

import { CHATS_QUERY_KEY } from "~/constants";
import { apiService } from "~/lib/api/api-service";
import {
  decryptLockedTitle,
  loadLockedConversationMessages,
  sealConversationMessages,
} from "~/lib/chat/locked-conversation";
import {
  createAdditionalLockKey,
  createLockMaterial,
  sealTitle,
  toConversationKey,
  unlockConversation,
  type LockEntryMethod,
  type UnlockAttempt,
} from "~/lib/crypto/conversation-lock";
import { useConversationLockStore } from "~/state/stores/conversationLockStore";
import type { Conversation, Message } from "~/types";

export const CONVERSATION_LOCK_QUERY_KEY = "conversation-lock";

export function isConversationLocked(conversation: Conversation | null | undefined): boolean {
  return Boolean(conversation?.locked_at);
}

export function useConversationLockState(conversationId: string | undefined) {
  const unlocked = useConversationLockStore((state) =>
    conversationId ? state.unlocked[conversationId] : undefined,
  );

  return {
    conversationKey: unlocked?.key ?? null,
    isUnlocked: Boolean(unlocked),
    unlockedTitle: unlocked?.title ?? null,
  };
}

export function useConversationLock(conversationId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: [CONVERSATION_LOCK_QUERY_KEY, conversationId],
    queryFn: async (): Promise<ConversationLock | null> => {
      if (!conversationId) {
        return null;
      }

      return apiService.conversationLocks.getLock(conversationId);
    },
    enabled: Boolean(conversationId) && enabled,
    staleTime: Number.POSITIVE_INFINITY,
  });
}

/**
 * Locking an existing conversation is a one-way migration: seal the thread, upload the
 * envelopes, and only then does the API destroy the plaintext it holds.
 */
export function useLockConversation() {
  const queryClient = useQueryClient();
  const unlock = useConversationLockStore((state) => state.unlock);

  return useMutation({
    mutationFn: async (params: {
      conversationId: string;
      method: LockEntryMethod;
      messages: Message[];
      title?: string | null;
    }) => {
      const { conversationId, method, messages, title } = params;
      const material = await createLockMaterial(conversationId, method);
      const sealed = await sealConversationMessages({
        conversationId,
        conversationKey: material.conversationKey,
        messages,
      });

      const lock = await apiService.conversationLocks.createLock(conversationId, {
        version: CONVERSATION_LOCK_VERSION,
        keys: material.keys,
        messages: sealed,
        title: title ? await sealTitle(conversationId, material.conversationKey, title) : null,
      });

      unlock(conversationId, {
        key: material.conversationKey,
        keyId: lock.keys[0]?.id ?? "",
        title: title ?? null,
      });

      return { lock, recoveryKey: material.recoveryKey };
    },
    onSuccess: (_result, variables) => {
      void queryClient.invalidateQueries({ queryKey: [CHATS_QUERY_KEY] });
      void queryClient.invalidateQueries({
        queryKey: [CONVERSATION_LOCK_QUERY_KEY, variables.conversationId],
      });
    },
  });
}

export function useUnlockConversation() {
  const queryClient = useQueryClient();
  const unlock = useConversationLockStore((state) => state.unlock);

  return useMutation({
    mutationFn: async (params: { lock: ConversationLock; attempt: UnlockAttempt }) => {
      const { lock, attempt } = params;
      const conversationId = lock.conversation_id;
      const result = await unlockConversation(lock, attempt);
      const conversationKey = await toConversationKey(result.material);
      const title = await decryptLockedTitle({
        conversationId,
        conversationKey,
        envelope: lock.title,
      });

      unlock(conversationId, {
        key: conversationKey,
        keyId: result.keyId,
        title,
      });

      const messages = await loadLockedConversationMessages({
        conversationId,
        conversationKey,
      });

      queryClient.setQueryData<Conversation>([CHATS_QUERY_KEY, conversationId], (existing) => ({
        ...(existing ?? { id: conversationId }),
        id: conversationId,
        title: title ?? "Locked chat",
        locked_at: existing?.locked_at ?? new Date().toISOString(),
        messages,
      }));

      return { messages, title };
    },
  });
}

/** Removing the lock writes the decrypted thread back before the envelopes are dropped. */
export function useRemoveConversationLock() {
  const queryClient = useQueryClient();
  const lockConversation = useConversationLockStore((state) => state.lock);

  return useMutation({
    mutationFn: async (params: {
      conversationId: string;
      messages: Message[];
      title: string | null;
    }) => {
      const { conversationId, messages, title } = params;

      await apiService.conversationLocks.deleteLock(conversationId, {
        title,
        messages: messages
          .filter(
            (message) => message.id && (message.role === "user" || message.role === "assistant"),
          )
          .map((message) => ({
            id: message.id as string,
            role: message.role as "user" | "assistant",
            content: typeof message.content === "string" ? message.content : "",
            model: message.model ?? null,
          })),
      });

      lockConversation(conversationId);
    },
    onSuccess: (_result, variables) => {
      void queryClient.invalidateQueries({ queryKey: [CHATS_QUERY_KEY] });
      queryClient.removeQueries({
        queryKey: [CONVERSATION_LOCK_QUERY_KEY, variables.conversationId],
      });
    },
  });
}

/**
 * Adding a second way in requires proving you can already open the conversation, so the
 * key material is unwrapped fresh rather than kept around for the purpose.
 */
export function useAddConversationLockKey() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      lock: ConversationLock;
      attempt: UnlockAttempt;
      method: LockEntryMethod;
    }) => {
      const result = await unlockConversation(params.lock, params.attempt);
      const key = await createAdditionalLockKey({
        conversationId: params.lock.conversation_id,
        conversationKeyMaterial: result.material,
        method: params.method,
      });

      return apiService.conversationLocks.addKey(params.lock.conversation_id, key);
    },
    onSuccess: (lock) => {
      queryClient.setQueryData([CONVERSATION_LOCK_QUERY_KEY, lock.conversation_id], lock);
    },
  });
}

export function useRemoveConversationLockKey() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { conversationId: string; keyId: string }) =>
      apiService.conversationLocks.deleteKey(params.conversationId, params.keyId),
    onSuccess: (lock) => {
      queryClient.setQueryData([CONVERSATION_LOCK_QUERY_KEY, lock.conversation_id], lock);
    },
  });
}

export function useLockConversationNow(conversationId: string | undefined) {
  const lock = useConversationLockStore((state) => state.lock);

  return useCallback(() => {
    if (conversationId) {
      lock(conversationId);
    }
  }, [conversationId, lock]);
}
