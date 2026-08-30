import { create } from "zustand";

interface UnlockedConversation {
  key: CryptoKey;
  keyId: string;
  title: string | null;
  unlockedAt: number;
}

interface ConversationLockStore {
  unlocked: Record<string, UnlockedConversation>;
  /** Set when something outside the header asks for the unlock prompt. */
  unlockRequestedFor: string | null;
  requestUnlock: (conversationId: string) => void;
  clearUnlockRequest: () => void;
  unlock: (conversationId: string, entry: Omit<UnlockedConversation, "unlockedAt">) => void;
  setUnlockedTitle: (conversationId: string, title: string | null) => void;
  lock: (conversationId: string) => void;
  lockAll: () => void;
}

/**
 * Conversation keys live here and nowhere else. Nothing in this store is persisted, so a
 * reload, a sign-out, or a closed tab puts every locked conversation back behind its key.
 *
 * apps/app runs the React Compiler, so lock state has to be read through this store rather
 * than a module variable, or an "unlocked" read gets cached across a lock.
 */
export const useConversationLockStore = create<ConversationLockStore>()((set) => ({
  unlocked: {},
  unlockRequestedFor: null,
  requestUnlock: (conversationId) => set({ unlockRequestedFor: conversationId }),
  clearUnlockRequest: () => set({ unlockRequestedFor: null }),
  unlock: (conversationId, entry) =>
    set((current) => ({
      unlocked: {
        ...current.unlocked,
        [conversationId]: { ...entry, unlockedAt: Date.now() },
      },
    })),
  setUnlockedTitle: (conversationId, title) =>
    set((current) => {
      const existing = current.unlocked[conversationId];

      if (!existing) {
        return current;
      }

      return {
        unlocked: {
          ...current.unlocked,
          [conversationId]: { ...existing, title },
        },
      };
    }),
  lock: (conversationId) =>
    set((current) => {
      if (!current.unlocked[conversationId]) {
        return current;
      }

      const { [conversationId]: _removed, ...rest } = current.unlocked;

      return { unlocked: rest };
    }),
  lockAll: () => set({ unlocked: {}, unlockRequestedFor: null }),
}));

export function getConversationKey(conversationId: string): CryptoKey | null {
  return useConversationLockStore.getState().unlocked[conversationId]?.key ?? null;
}
