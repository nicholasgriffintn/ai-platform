import { createAuth, type ExternalIdentity } from "@ngriffin_uk/auth-core";
import { createRemoteJwksResolver } from "@ngriffin_uk/auth-jwt";
import { createOAuthProvider, defineOAuthProvider } from "@ngriffin_uk/auth-oauth2";
import { sha256Hex } from "@ngriffin_uk/polychat-utility-core";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import { appendUrlPath } from "@ngriffin_uk/polychat-utility-server/urls";

import { AUTH_SESSION_TTL_MS } from "~/config/app";
import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import {
  createAssistantUserStore,
  type AssistantAuthUser,
} from "~/modules/auth/application/authUser";

import { resolveOidcProfile } from "./claims";
import { openOidcSecret, toOidcConnection } from "./configuration";
import { createOidcFetcher, discoverOidcEndpoints } from "./discovery";
import { createOidcIdentityStore, requireOidcLinkSession } from "./identity";

export async function createEnterpriseOidcProvider(
  context: ServiceContext,
  connectionId: string,
  options: {
    browserToken?: string;
    cookies?: string;
  } = {},
) {
  const row = await context.repositories.enterpriseIdentities.getById(connectionId);

  if (!row || Number(row.enabled) !== 1) {
    throw new AssistantError("Enterprise identity connection not found", ErrorType.NOT_FOUND, 404);
  }

  const connection = toOidcConnection(row);
  const metadata = await discoverOidcEndpoints(connection);
  const providerName = `enterprise-${connection.id}-${connection.revision}`;

  if (!context.env.API_BASE_URL) {
    throw new AssistantError(
      "Authentication callback URL is not configured",
      ErrorType.CONFIGURATION_ERROR,
      503,
    );
  }

  const redirectUri = appendUrlPath(
    context.env.API_BASE_URL,
    `auth/enterprise/${connection.id}/callback`,
  );
  const fetcher = createOidcFetcher(connection);
  const plugin = createOAuthProvider<string, AssistantAuthUser>(
    defineOAuthProvider({
      name: providerName,
      authorizationEndpoint: metadata.authorization_endpoint,
      tokenEndpoint: metadata.token_endpoint,
      pkce: true,
      clientAuthentication: "basic",
    }),
    {
      clientId: connection.clientId,
      clientSecret: () => openOidcSecret(context, row),
      redirectUri,
      scopes: ["openid", "email", "profile"],
      stateStore: context.repositories.oauthStates,
      stateTtlMs: 10 * 60 * 1000,
      fetch: fetcher,
      oidc: {
        issuer: connection.issuer,
        audience: connection.clientId,
        algorithms: [connection.signingAlgorithm],
        key: createRemoteJwksResolver({
          url: metadata.jwks_uri,
          fetch: fetcher,
          timeoutMs: 10_000,
          maxResponseBytes: 65_536,
        }),
      },
      async resolveIdentity(_tokens, claims, stateContext): Promise<ExternalIdentity> {
        if (
          !options.browserToken ||
          stateContext.browserHash !== (await sha256Hex(options.browserToken))
        ) {
          throw new AssistantError(
            "Restart enterprise sign-in in this browser",
            ErrorType.AUTHENTICATION_ERROR,
            401,
          );
        }

        let linkUserId: number | undefined;

        if (stateContext.linkUserId) {
          const session = await requireOidcLinkSession(context, options.cookies ?? "");

          if (
            String(session.userId) !== stateContext.linkUserId ||
            session.tokenHash !== stateContext.linkSessionHash
          ) {
            throw new AssistantError(
              "The account linking session changed",
              ErrorType.AUTHENTICATION_ERROR,
              401,
            );
          }

          linkUserId = session.userId;
        }

        let profile: ReturnType<typeof resolveOidcProfile>;

        try {
          profile = resolveOidcProfile(connection, claims);
          if (!profile.role || profile.expiresAt.getTime() <= Date.now()) {
            throw new Error("Group access is unavailable");
          }
        } catch {
          if (typeof claims?.sub === "string" && claims.sub.length <= 500) {
            await context.repositories.enterpriseIdentities.revokeSubjectMembership(
              connection,
              claims.sub,
            );
          }

          throw new AssistantError(
            "Your identity groups do not currently grant access to this workspace",
            ErrorType.AUTHORISATION_ERROR,
            403,
          );
        }

        return {
          provider: providerName,
          providerSubject: profile.sub,
          email: profile.email,
          emailVerified: true,
          claims: {
            email: profile.email,
            name: profile.name,
            role: profile.role,
            expiresAt: profile.expiresAt.toISOString(),
            ...(linkUserId ? { linkUserId } : {}),
            ...(stateContext.nativeRedirectUri
              ? {
                  continuation: {
                    nativeRedirectUri: stateContext.nativeRedirectUri,
                    nativePlatform: stateContext.nativePlatform,
                    ...(stateContext.nativeClientState
                      ? { nativeClientState: stateContext.nativeClientState }
                      : {}),
                  },
                }
              : {}),
          },
        };
      },
    },
  );
  const auth = createAuth({
    users: createAssistantUserStore(context),
    sessions: context.repositories.sessions,
    identities: createOidcIdentityStore(context, connection, providerName),
    sessionTtlMs: AUTH_SESSION_TTL_MS,
  }).use(plugin);
  const provider = auth.providers[providerName];

  if (!provider) {
    throw new AssistantError(
      "Enterprise authentication provider is unavailable",
      ErrorType.CONFIGURATION_ERROR,
      503,
    );
  }

  return { connection, provider };
}
