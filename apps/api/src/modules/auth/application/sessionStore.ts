import type { SessionStore, UserStore } from "@ngriffin_uk/auth-core";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import type { User } from "~/types";

import { createAssistantUserStore, toAssistantAuthUser, type AssistantAuthUser } from "./authUser";

export interface AssistantSessionStores {
  sessions: SessionStore;
  users: UserStore<AssistantAuthUser>;
}

export function createAssistantSessionStores(context: ServiceContext): AssistantSessionStores {
  const repository = context.repositories.sessions;
  const userStore = createAssistantUserStore(context);
  const sessionUsers = new Map<string, User>();

  return {
    sessions: {
      create: (record) => repository.create(record),
      async findByTokenHash(tokenHash) {
        const found = await repository.findWithUserByTokenHash(tokenHash);

        if (found?.user) {
          sessionUsers.set(found.session.userId, found.user);
        }

        return found?.session ?? null;
      },
      deleteByTokenHash: (tokenHash) => repository.deleteByTokenHash(tokenHash),
      rotateByTokenHash: (currentTokenHash, replacement) =>
        repository.rotateByTokenHash(currentTokenHash, replacement),
      touchByTokenHash: (tokenHash, expiresAt) => repository.touchByTokenHash(tokenHash, expiresAt),
      deleteByUserId: (userId) => repository.deleteByUserId(userId),
    },
    users: {
      async findById(userId) {
        const joined = sessionUsers.get(userId);

        if (!joined) {
          return userStore.findById(userId);
        }

        sessionUsers.delete(userId);

        return toAssistantAuthUser(joined);
      },
    },
  };
}
