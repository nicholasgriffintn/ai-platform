import type { AuthUserWithEmail, UserStore } from "@ngriffin_uk/auth-core";

import type { ServiceContext } from "~/lib/context/serviceContext";
import { listConfigurableUserProviderIds } from "~/lib/providers/userConfigurableProviders";
import type { User } from "~/types";

export interface AssistantAuthUser extends AuthUserWithEmail {
  readonly record: User;
  readonly continuation?: Readonly<{ mobileRedirectUri?: string }>;
}

export function createAssistantUserStore(context: ServiceContext): UserStore<AssistantAuthUser> {
  return {
    async findById(userId) {
      const id = Number(userId);

      if (!Number.isSafeInteger(id)) {
        return null;
      }

      const user = await context.repositories.users.getUserById(id);

      return user ? toAssistantAuthUser(user) : null;
    },
  };
}

export async function resolveAssistantEmailUser(
  context: ServiceContext,
  email: string,
): Promise<AssistantAuthUser | null> {
  const existing = await context.repositories.users.getUserByEmail(email);

  if (existing) {
    return toAssistantAuthUser(existing);
  }

  const created = await context.repositories.users.createUser({ email });

  if (!created) {
    return null;
  }

  await initialiseAssistantUser(context, created.id);

  return toAssistantAuthUser(created);
}

export async function initialiseAssistantUser(
  context: ServiceContext,
  userId: number,
): Promise<void> {
  await Promise.allSettled([
    context.repositories.userSettings.createUserSettings(userId),
    context.repositories.userSettings.createUserProviderSettings(
      userId,
      listConfigurableUserProviderIds(),
    ),
  ]);
}

export function toAssistantAuthUser(record: User): AssistantAuthUser {
  return {
    id: String(record.id),
    email: record.email,
    createdAt: new Date(record.created_at),
    record,
  };
}
