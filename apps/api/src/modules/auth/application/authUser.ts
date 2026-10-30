import type { AuthUserWithEmail, UserStore } from "@ngriffin_uk/auth-core";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { seedStarterNotebook } from "~/modules/notebooks/application/starter";
import { UserRepository } from "~/modules/user/infrastructure/UserRepository";
import type { User } from "~/types";

import { ensureUserProvisioned } from "./user";

export interface AssistantAuthUser extends AuthUserWithEmail {
  readonly record: User;
  readonly continuation?: Readonly<{
    nativeRedirectUri?: string;
    nativePlatform?: "mobile" | "desktop";
    nativeClientState?: string;
  }>;
}

export function createAssistantUserStore(context: ServiceContext): UserStore<AssistantAuthUser> {
  return {
    async findById(userId) {
      const id = Number(userId);

      if (!Number.isSafeInteger(id)) {
        return null;
      }

      const user = await context.repositories.get(UserRepository).getUserById(id);

      return user ? toAssistantAuthUser(user) : null;
    },
  };
}

export async function resolveAssistantEmailUser(
  context: ServiceContext,
  email: string,
): Promise<AssistantAuthUser | null> {
  const existing = await context.repositories.get(UserRepository).getUserByEmail(email);

  if (existing) {
    await initialiseAssistantUser(context, existing.id);

    return toAssistantAuthUser(existing);
  }

  const created = await context.repositories.get(UserRepository).createUser({ email });

  if (!created) {
    return null;
  }

  await initialiseAssistantUser(context, created.id, { firstSignIn: true });

  return toAssistantAuthUser(created);
}

export async function initialiseAssistantUser(
  context: ServiceContext,
  userId: number,
  options: { firstSignIn?: boolean } = {},
): Promise<void> {
  await Promise.allSettled([ensureUserProvisioned(context.repositories, userId)]);

  if (!options.firstSignIn) {
    return;
  }

  const user = await context.repositories.get(UserRepository).getUserById(userId);

  if (user) {
    await seedStarterNotebook(context, user);
  }
}

export function toAssistantAuthUser(record: User): AssistantAuthUser {
  return {
    id: String(record.id),
    email: record.email,
    createdAt: new Date(record.created_at),
    record,
  };
}
