import type { ExternalIdentity, IdentityStore } from "@ngriffin_uk/auth-core";
import { getStringRecordValue } from "@ngriffin_uk/polychat-utility-server/objects";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import {
  type AssistantAuthUser,
  initialiseAssistantUser,
  toAssistantAuthUser,
} from "~/modules/auth/application/authUser";
import { resolveGitHubUser } from "~/modules/auth/application/github";
import { UserRepository } from "~/modules/user/infrastructure/UserRepository";

export function createAssistantIdentityStore(
  context: ServiceContext,
): IdentityStore<AssistantAuthUser> {
  return {
    async findUser(provider, providerSubject) {
      const user = await context.repositories
        .get(UserRepository)
        .getUserByOauthAccount(provider, providerSubject);

      return user ? toAssistantAuthUser(user) : null;
    },
    async resolve(identity) {
      let user: AssistantAuthUser;

      if (identity.provider === "apple") {
        user = await resolveAppleUser(context, identity);
      } else if (identity.provider === "github") {
        user = await resolveGitHubUser(context, identity);
      } else {
        throw new TypeError("Unsupported external identity provider.");
      }

      await initialiseAssistantUser(context, user.record.id);

      return user;
    },
  };
}

async function resolveAppleUser(
  context: ServiceContext,
  identity: ExternalIdentity,
): Promise<AssistantAuthUser> {
  const existing = await context.repositories
    .get(UserRepository)
    .getUserByOauthAccount("apple", identity.providerSubject);
  const name = getStringRecordValue(identity.claims, "name");

  if (existing) {
    const updates: Record<string, string> = {};

    if (name) {
      updates.name = name;
    }

    if (identity.emailVerified && identity.email) {
      updates.email = identity.email;
    }

    if (Object.keys(updates).length > 0) {
      await context.repositories.get(UserRepository).updateUser(existing.id, updates);
    }

    const updated = await context.repositories.get(UserRepository).getUserById(existing.id);

    return toAssistantAuthUser(updated ?? existing);
  }

  if (!identity.emailVerified || !identity.email) {
    throw new TypeError("A verified Apple email address is required for first sign-in.");
  }

  const emailUser = await context.repositories.get(UserRepository).getUserByEmail(identity.email);

  if (emailUser) {
    await context.repositories
      .get(UserRepository)
      .createOauthAccount(emailUser.id, "apple", identity.providerSubject);
    if (name) {
      await context.repositories.get(UserRepository).updateUser(emailUser.id, { name });
    }

    const updated = await context.repositories.get(UserRepository).getUserById(emailUser.id);

    return toAssistantAuthUser(updated ?? emailUser);
  }

  const created = await context.repositories.get(UserRepository).createUser({
    email: identity.email,
    name,
  });

  if (!created) {
    throw new TypeError("Apple user creation failed.");
  }

  await context.repositories
    .get(UserRepository)
    .createOauthAccount(created.id, "apple", identity.providerSubject);
  await initialiseAssistantUser(context, created.id, { firstSignIn: true });

  return toAssistantAuthUser(created);
}
