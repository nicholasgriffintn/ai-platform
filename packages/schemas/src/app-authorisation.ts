import z from "zod/v4";

import type { DeviceCredentialScope } from "./device-authorisation.js";

export const APP_AUTHORISATION_EXPIRES_IN_SECONDS = 600;
export const APP_AUTHORISATION_CODE_EXPIRES_IN_SECONDS = 60;

interface AppClient {
  name: string;
  redirectUris: readonly string[];
  redirectPath: string;
  scope: DeviceCredentialScope;
}

export const APP_CLIENTS = {
  pashi: {
    name: "Pashi",
    redirectPath: "/api/polychat/callback",
    redirectUris: ["https://pashi.app/api/polychat/callback"],
    scope: "pashi",
  },
} as const satisfies Record<string, AppClient>;

export type AppClientId = keyof typeof APP_CLIENTS;

export const appClientIdSchema = z.enum(["pashi"]);

export function isAppClientScope(scope: DeviceCredentialScope): boolean {
  return Object.values(APP_CLIENTS).some((client) => client.scope === scope);
}

export function isAppRedirectUri(
  clientId: AppClientId,
  redirectUri: string,
  allowLoopback: boolean,
): boolean {
  const client = APP_CLIENTS[clientId];

  if (client.redirectUris.some((uri) => uri === redirectUri)) {
    return true;
  }

  if (!allowLoopback || !URL.canParse(redirectUri)) {
    return false;
  }

  const { hostname, pathname, protocol, search } = new URL(redirectUri);

  return (
    protocol === "http:" &&
    hostname === "localhost" &&
    pathname === client.redirectPath &&
    search === ""
  );
}

const pkceValueSchema = z.string().regex(/^[A-Za-z0-9._~-]{43,128}$/);

export const appAuthorisationStartSchema = z.object({
  client_id: appClientIdSchema,
  redirect_uri: z.string().min(1).max(500),
  state: z.string().min(32).max(200),
  code_challenge: pkceValueSchema,
  code_challenge_method: z.literal("S256"),
});

export type AppAuthorisationStart = z.infer<typeof appAuthorisationStartSchema>;

export const appAuthorisationStartResponseSchema = z.object({
  authorisation_url: z.string().min(1),
  expires_in: z.number().int().positive(),
});

export type AppAuthorisationStartResponse = z.infer<typeof appAuthorisationStartResponseSchema>;

export const appTokenRequestSchema = z.object({
  client_id: appClientIdSchema,
  code: z.string().trim().min(1).max(200),
  code_verifier: pkceValueSchema,
  redirect_uri: z.string().min(1).max(500),
});

export type AppTokenRequest = z.infer<typeof appTokenRequestSchema>;

export const appTokenResponseSchema = z.object({
  access_token: z.string().min(1),
  token_type: z.literal("Bearer"),
});

export type AppTokenResponse = z.infer<typeof appTokenResponseSchema>;
