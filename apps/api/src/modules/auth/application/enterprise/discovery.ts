import type { OidcConnection } from "@ngriffin_uk/polychat-schemas";
import { publicHttpsUrlSchema } from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import { readResponseTextWithinLimit } from "@ngriffin_uk/polychat-utility-server/http";
import { safeParseJson } from "@ngriffin_uk/polychat-utility-server/json";
import z from "zod/v4";

const configurationSchema = z.object({
  issuer: publicHttpsUrlSchema,
  authorization_endpoint: publicHttpsUrlSchema,
  token_endpoint: publicHttpsUrlSchema,
  jwks_uri: publicHttpsUrlSchema,
  id_token_signing_alg_values_supported: z.array(z.string()).min(1).max(32),
  code_challenge_methods_supported: z.array(z.string()).max(8).optional(),
});

export function createOidcFetcher(connection: OidcConnection): typeof fetch {
  const origins = new Set([new URL(connection.issuer).origin, ...connection.allowedOrigins]);

  return async (input, options) => {
    const url = publicHttpsUrlSchema.parse(input instanceof Request ? input.url : input.toString());

    if (!origins.has(new URL(url).origin)) {
      throw new AssistantError(
        "Identity endpoint is outside the configured origins",
        ErrorType.CONFIGURATION_ERROR,
        503,
      );
    }

    return fetch(input, { ...options, redirect: "error" });
  };
}

export async function discoverOidcEndpoints(connection: OidcConnection) {
  const fetcher = createOidcFetcher(connection);

  try {
    const discoveryUrl = connection.issuer.replace(/\/$/, "") + "/.well-known/openid-configuration";
    const response = await fetcher(discoveryUrl, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      throw new Error("Discovery failed");
    }

    const result = configurationSchema.parse(
      safeParseJson(await readResponseTextWithinLimit(response, 65_536)),
    );

    if (
      result.issuer !== connection.issuer ||
      !result.id_token_signing_alg_values_supported.includes(connection.signingAlgorithm) ||
      (result.code_challenge_methods_supported &&
        !result.code_challenge_methods_supported.includes("S256"))
    ) {
      throw new Error("Discovery configuration does not match the pinned identity provider");
    }

    const origins = new Set([new URL(connection.issuer).origin, ...connection.allowedOrigins]);

    for (const endpoint of [
      result.authorization_endpoint,
      result.token_endpoint,
      result.jwks_uri,
    ]) {
      if (!origins.has(new URL(endpoint).origin)) {
        throw new Error("Discovery endpoint is not permitted");
      }
    }

    return result;
  } catch {
    throw new AssistantError(
      "The configured identity provider could not be verified",
      ErrorType.CONFIGURATION_ERROR,
      503,
    );
  }
}
