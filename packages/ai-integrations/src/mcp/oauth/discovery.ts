import { readResponseTextWithinLimit } from "@ngriffin_uk/polychat-utility-server/http";
import { safeParseJson } from "@ngriffin_uk/polychat-utility-server/json";
import type z from "zod/v4";

import { McpRequestError } from "../errors.js";
import { parseMcpServerUrl } from "../server-url.js";
import {
  authorizationServerMetadataSchema,
  protectedResourceMetadataSchema,
  type McpAuthorizationDiscovery,
} from "./metadata.js";

const DISCOVERY_TIMEOUT_MS = 10_000;
const MAX_METADATA_BYTES = 100_000;

function wellKnownUrls(base: URL, suffix: string): string[] {
  const path = base.pathname.replace(/\/+$/, "");
  const urls = [
    `${base.origin}/.well-known/${suffix}${path}`,
    `${base.origin}/.well-known/${suffix}`,
  ];

  return [...new Set(urls)];
}

async function fetchMetadata<T extends z.ZodType>(
  urls: readonly string[],
  schema: T,
  fetchImpl: typeof globalThis.fetch,
): Promise<z.infer<T> | null> {
  for (const url of urls) {
    try {
      const response = await fetchImpl(url, {
        headers: { Accept: "application/json" },
        redirect: "error",
        signal: AbortSignal.timeout(DISCOVERY_TIMEOUT_MS),
      });

      if (!response.ok) {
        continue;
      }

      const parsed = schema.safeParse(
        safeParseJson(await readResponseTextWithinLimit(response, MAX_METADATA_BYTES)),
      );

      if (parsed.success) {
        return parsed.data;
      }
    } catch {
      continue;
    }
  }

  return null;
}

export async function discoverMcpAuthorization(params: {
  serverUrl: string;
  fetch?: typeof globalThis.fetch;
}): Promise<McpAuthorizationDiscovery> {
  const fetchImpl = params.fetch ?? globalThis.fetch.bind(globalThis);
  const server = parseMcpServerUrl(params.serverUrl, "oauth/discovery");
  const resourceMetadata = await fetchMetadata(
    wellKnownUrls(server, "oauth-protected-resource"),
    protectedResourceMetadataSchema,
    fetchImpl,
  );
  const issuer = parseMcpServerUrl(
    resourceMetadata?.authorization_servers?.[0] ?? server.origin,
    "oauth/discovery",
  );
  const metadata = await fetchMetadata(
    [
      ...wellKnownUrls(issuer, "oauth-authorization-server"),
      ...wellKnownUrls(issuer, "openid-configuration"),
    ],
    authorizationServerMetadataSchema,
    fetchImpl,
  );

  if (!metadata) {
    throw new McpRequestError({
      code: "invalid_response",
      operation: "oauth/discovery",
      message: "This MCP server does not publish OAuth metadata. Connect it with a token instead.",
      requestSent: true,
    });
  }

  if (
    metadata.code_challenge_methods_supported &&
    !metadata.code_challenge_methods_supported.includes("S256")
  ) {
    throw new McpRequestError({
      code: "invalid_response",
      operation: "oauth/discovery",
      message: "This MCP server's sign-in does not support PKCE, so it cannot be connected safely.",
      requestSent: true,
    });
  }

  return {
    resource: resourceMetadata?.resource ?? `${server.origin}${server.pathname}`,
    authorizationServer: {
      issuer: metadata.issuer,
      authorizationEndpoint: parseMcpServerUrl(metadata.authorization_endpoint).toString(),
      tokenEndpoint: parseMcpServerUrl(metadata.token_endpoint).toString(),
      ...(metadata.registration_endpoint
        ? { registrationEndpoint: parseMcpServerUrl(metadata.registration_endpoint).toString() }
        : {}),
    },
    ...(resourceMetadata?.scopes_supported?.length
      ? { scopes: resourceMetadata.scopes_supported }
      : {}),
  };
}
