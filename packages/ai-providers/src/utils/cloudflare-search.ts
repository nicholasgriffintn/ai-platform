import {
  cloudflareWebSearchProviderSchema,
  searchOptionsSchema,
} from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import {
  readResponseTextWithinLimit,
  parsePublicHttpUrl,
} from "@ngriffin_uk/polychat-utility-server/http";
import z from "zod/v4";

import type { ProviderEnv } from "../env.js";
import type { SearchOptions } from "../types/search.js";

const identifierSchema = z.string().regex(/^[a-zA-Z0-9_-]{1,64}$/);
const aliasSchema = identifierSchema.optional();

export function requireCloudflareSearchConfig(value: unknown, name: string): string {
  const parsed = identifierSchema.safeParse(value);

  if (!parsed.success) {
    throw new AssistantError(
      `${name} is required and must be a valid identifier`,
      ErrorType.CONFIGURATION_ERROR,
    );
  }

  return parsed.data;
}

export function parseCloudflareSearchOptions(
  query: string,
  options?: SearchOptions,
): SearchOptions {
  if (!query.trim() || query.length > 1024) {
    throw new AssistantError(
      "Cloudflare search queries must contain 1–1024 characters",
      ErrorType.PARAMS_ERROR,
    );
  }

  const parsed = searchOptionsSchema.safeParse(options ?? {});

  if (!parsed.success) {
    throw new AssistantError("Invalid search options", ErrorType.PARAMS_ERROR);
  }

  return parsed.data;
}

export function getCloudflareWebSearchSettings(env: ProviderEnv, options: SearchOptions) {
  const provider = cloudflareWebSearchProviderSchema.safeParse(
    options.cloudflare_provider ?? env.CLOUDFLARE_WEB_SEARCH_PROVIDER ?? "ceramic",
  );
  const alias = aliasSchema.safeParse(env.CLOUDFLARE_WEB_SEARCH_BYOK_ALIAS || undefined);

  if (!provider.success || !alias.success) {
    throw new AssistantError(
      "Invalid Cloudflare web search provider or BYOK alias",
      ErrorType.CONFIGURATION_ERROR,
    );
  }

  return { provider: provider.data, byokAlias: alias.data };
}

export function readPublicSearchUrl(value: string): URL | undefined {
  try {
    const url = parsePublicHttpUrl(value);

    return url;
  } catch {
    return undefined;
  }
}

export async function postCloudflareSearch(
  endpoint: string,
  token: string,
  body: unknown,
): Promise<unknown> {
  const response = await fetch(endpoint, {
    method: "POST",
    redirect: "error",
    signal: AbortSignal.timeout(30_000),
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new AssistantError(
      `Cloudflare search failed (${response.status})`,
      ErrorType.PROVIDER_ERROR,
    );
  }

  return JSON.parse(await readResponseTextWithinLimit(response, 2 * 1024 * 1024));
}
