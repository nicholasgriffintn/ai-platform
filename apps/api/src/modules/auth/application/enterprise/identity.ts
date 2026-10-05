import { hashSecret, type ExternalIdentity, type IdentityStore } from "@ngriffin_uk/auth-core";
import { authorise } from "@ngriffin_uk/polychat-library-policy";
import type { OidcConnection } from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import z from "zod/v4";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import {
  initialiseAssistantUser,
  toAssistantAuthUser,
  createAssistantUserStore,
  type AssistantAuthUser,
} from "~/modules/auth/application/authUser";
import { extractSessionIdFromCookies } from "~/modules/auth/application/sessions";

const storedProfileSchema = z.object({
  email: z.email(),
  name: z.string().max(200).optional(),
  role: z.enum(["admin", "member"]),
  expiresAt: z.iso.datetime(),
  linkUserId: z.number().int().positive().optional(),
  continuation: z
    .object({
      nativeRedirectUri: z.string(),
      nativePlatform: z.enum(["mobile", "desktop"]),
      nativeClientState: z.string().optional(),
    })
    .optional(),
});

export async function requireOidcLinkSession(context: ServiceContext, cookies: string) {
  const token = extractSessionIdFromCookies(cookies);

  if (!token) {
    throw new AssistantError(
      "Sign in to your existing account before linking enterprise identity",
      ErrorType.AUTHENTICATION_ERROR,
      401,
    );
  }

  const tokenHash = await hashSecret(token);
  const session = await context.repositories.sessions.findByTokenHash(tokenHash);

  if (!session || session.expiresAt.getTime() <= Date.now()) {
    throw new AssistantError(
      "Sign in again before linking enterprise identity",
      ErrorType.AUTHENTICATION_ERROR,
      401,
    );
  }

  const userId = Number(session.userId);

  if (!Number.isSafeInteger(userId) || userId < 1) {
    throw new AssistantError(
      "The account being linked is unavailable",
      ErrorType.AUTHENTICATION_ERROR,
      401,
    );
  }

  return { userId, tokenHash };
}

export function createOidcIdentityStore(
  context: ServiceContext,
  connection: OidcConnection,
  providerName: string,
): IdentityStore<AssistantAuthUser> {
  const stableProvider = `enterprise-${connection.id}`;

  return {
    async findUser(provider, subject) {
      if (provider !== providerName) {
        return null;
      }

      const user = await context.repositories.users.getUserByOauthAccount(stableProvider, subject);

      return user ? toAssistantAuthUser(user) : null;
    },
    async resolve(identity: ExternalIdentity) {
      if (identity.provider !== providerName || !identity.emailVerified) {
        throw new AssistantError(
          "Enterprise identity is invalid",
          ErrorType.AUTHENTICATION_ERROR,
          401,
        );
      }

      const profile = storedProfileSchema.parse(identity.claims);
      let user = await context.repositories.users.getUserByOauthAccount(
        stableProvider,
        identity.providerSubject,
      );

      if (profile.linkUserId) {
        if (user && user.id !== profile.linkUserId) {
          throw new AssistantError(
            "This enterprise identity is already linked to another account",
            ErrorType.CONFLICT_ERROR,
            409,
          );
        }

        const target = await createAssistantUserStore(context).findById(String(profile.linkUserId));

        if (!target) {
          throw new AssistantError(
            "The account being linked is unavailable",
            ErrorType.AUTHENTICATION_ERROR,
            401,
          );
        }

        await context.repositories.enterpriseIdentities.linkSubject(
          connection,
          identity.providerSubject,
          profile.linkUserId,
        );
        user = await context.repositories.users.getUserByOauthAccount(
          stableProvider,
          identity.providerSubject,
        );
        if (user?.id !== profile.linkUserId) {
          throw new AssistantError(
            "Enterprise identity changed while linking",
            ErrorType.CONFLICT_ERROR,
            409,
          );
        }
      } else if (!user) {
        if (await context.repositories.users.getUserByEmail(profile.email)) {
          throw new AssistantError(
            "This email already has an account. Sign in and explicitly link enterprise identity",
            ErrorType.CONFLICT_ERROR,
            409,
          );
        }

        user = await context.repositories.enterpriseIdentities.createUserForSubject(connection, {
          subject: identity.providerSubject,
          email: profile.email,
          name: profile.name,
        });
      }

      if (!user) {
        throw new AssistantError(
          "Enterprise account could not be provisioned",
          ErrorType.INTERNAL_ERROR,
          500,
        );
      }

      const current = await context.repositories.enterpriseIdentities.getById(connection.id);
      const allowed = authorise("workspace.identity.provision", {
        verified: true,
        enabled: Number(current?.enabled) === 1,
        revisionCurrent: current?.revision === connection.revision,
        groupsMapped: true,
        leaseCurrent: new Date(profile.expiresAt).getTime() > Date.now(),
        role: profile.role,
      }).allowed;

      if (
        !allowed ||
        !(await context.repositories.enterpriseIdentities.grantMembership({
          connection,
          userId: user.id,
          role: profile.role,
          expiresAt: profile.expiresAt,
        }))
      ) {
        throw new AssistantError(
          "Enterprise access changed before sign-in completed",
          ErrorType.AUTHORISATION_ERROR,
          403,
        );
      }

      await initialiseAssistantUser(context, user.id);

      return {
        ...toAssistantAuthUser(user),
        ...(profile.continuation ? { continuation: profile.continuation } : {}),
      };
    },
  };
}
