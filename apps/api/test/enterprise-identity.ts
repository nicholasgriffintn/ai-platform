import type { D1Database } from "@cloudflare/workers-types";
import { encodeBase64Url } from "@ngriffin_uk/auth-encoding";
import { signJwt, type JwtClaims } from "@ngriffin_uk/auth-jwt";
import type { OidcConnection } from "@ngriffin_uk/polychat-schemas";
import { generateId } from "@ngriffin_uk/polychat-utility-core";

import { createServiceContext, type ServiceContext } from "~/infrastructure/context/serviceContext";
import {
  completeEnterpriseSignIn,
  startEnterpriseSignIn,
} from "~/modules/auth/application/enterprise/flow";

import { createMigratedTestDatabase } from "./database";
import { databaseTestEnvironment } from "./environment";

export const oidcTestIssuer = "https://identity.example.com/";
export const oidcTestClientId = "polychat-test";

export async function createEnterpriseIdentityDatabase() {
  const { runtime, database } = await createMigratedTestDatabase();

  await database.batch([
    database.prepare(
      "INSERT OR IGNORE INTO plans (id, name) VALUES ('free', 'Free'), ('pro', 'Pro')",
    ),
    database.prepare(
      "INSERT INTO user (id, email, plan_id) VALUES (42, 'owner@example.test', 'pro')",
    ),
  ]);

  return { runtime, database };
}

export async function createEnterpriseIdentityContext(database: D1Database) {
  const env = Object.assign(databaseTestEnvironment(database), {
    JWT_SECRET: "enterprise-test-encryption-key",
    API_BASE_URL: "https://api.polychat.app",
    APP_BASE_URL: "https://polychat.app",
  });
  const anonymous = createServiceContext({ env });
  const owner = await anonymous.repositories.users.getUserById(42);

  if (!owner) {
    throw new Error("Enterprise test owner is missing");
  }

  const context = createServiceContext({ env, user: owner });
  const workspaceId = generateId();

  await context.repositories.workspaces.createWorkspace({
    id: workspaceId,
    name: "Enterprise workspace",
    description: "",
    colour: "#000000",
    userId: owner.id,
  });

  return { context, workspaceId };
}

export async function createOidcTestProvider() {
  const keyPair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, [
    "sign",
    "verify",
  ]);
  const publicKey = await crypto.subtle.exportKey("jwk", keyPair.publicKey);
  const authorisations = new Map<string, URL>();
  const controls: {
    claims: JwtClaims;
    metadata: Record<string, unknown>;
    tokenRequestCount: number;
  } = {
    claims: {
      sub: generateId(),
      email: `member-${generateId()}@example.test`,
      groups: ["employees"],
    },
    metadata: {},
    tokenRequestCount: 0,
  };

  const fetcher: typeof fetch = async (input, options) => {
    const request = new Request(input, options);
    const url = new URL(request.url);

    if (url.href === oidcTestIssuer + ".well-known/openid-configuration") {
      return Response.json({
        issuer: oidcTestIssuer,
        authorization_endpoint: oidcTestIssuer + "authorize",
        token_endpoint: oidcTestIssuer + "token",
        jwks_uri: oidcTestIssuer + "keys",
        id_token_signing_alg_values_supported: ["ES256"],
        code_challenge_methods_supported: ["S256"],
        ...controls.metadata,
      });
    }

    if (url.href === oidcTestIssuer + "keys") {
      return Response.json({ keys: [{ ...publicKey, kid: "test-key", use: "sig", alg: "ES256" }] });
    }

    if (url.href !== oidcTestIssuer + "token") {
      throw new Error("Unexpected identity endpoint");
    }

    controls.tokenRequestCount += 1;
    const body = new URLSearchParams(await request.text());
    const authorisation = authorisations.get(body.get("code") ?? "");
    const verifier = body.get("code_verifier");
    const challenge = verifier
      ? encodeBase64Url(
          new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier))),
        )
      : "";

    if (
      !authorisation ||
      request.headers.get("authorization") !==
        "Basic " + btoa(oidcTestClientId + ":test-client-secret") ||
      body.get("redirect_uri") !== authorisation.searchParams.get("redirect_uri") ||
      challenge !== authorisation.searchParams.get("code_challenge") ||
      authorisation.searchParams.get("code_challenge_method") !== "S256"
    ) {
      return Response.json({ error: "invalid_grant" }, { status: 400 });
    }

    const now = Math.floor(Date.now() / 1000);
    const idToken = await signJwt(
      {
        iss: oidcTestIssuer,
        aud: oidcTestClientId,
        iat: now,
        exp: now + 3600,
        nonce: authorisation.searchParams.get("nonce"),
        email_verified: true,
        ...controls.claims,
      },
      { algorithm: "ES256", key: keyPair.privateKey, header: { kid: "test-key" } },
    );

    return Response.json({
      access_token: "test-access-token",
      token_type: "Bearer",
      id_token: idToken,
    });
  };

  const start = async (
    context: ServiceContext,
    connection: OidcConnection,
    options: {
      cookie?: string;
      link?: boolean;
      platform?: "desktop";
      redirectUri?: string;
      clientState?: string;
    } = {},
  ) => {
    const result = await startEnterpriseSignIn(
      context,
      connection.id,
      new Request("https://api.polychat.app/auth/enterprise/" + connection.id, {
        headers: options.cookie ? { cookie: options.cookie } : {},
      }),
      {
        link: options.link ?? false,
        platform: options.platform,
        redirect_uri: options.redirectUri,
        client_state: options.clientState,
      },
    );
    const code = generateId();
    const url = new URL(result.url);

    authorisations.set(code, url);
    const state = url.searchParams.get("state");

    if (!state) {
      throw new Error("Identity flow returned no state");
    }

    const cookie = result.cookie.split(";")[0] + (options.cookie ? "; " + options.cookie : "");

    return { code, state, cookie };
  };

  const complete = (
    context: ServiceContext,
    connection: OidcConnection,
    flow: {
      code: string;
      state: string;
      cookie: string;
    },
  ) =>
    completeEnterpriseSignIn(
      context,
      connection.id,
      new Request("https://api.polychat.app/auth/enterprise/" + connection.id + "/callback", {
        headers: { cookie: flow.cookie },
      }),
      { code: flow.code, state: flow.state },
    );

  return { controls, fetcher, start, complete };
}
