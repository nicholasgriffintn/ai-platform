import { resolveHttpUrl } from "@ngriffin_uk/polychat-utility-core";

import { CliError } from "./errors.js";

export const DEFAULT_API_BASE_URL = "https://api.polychat.app";

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

export function resolveApiBaseUrl(input: string | undefined): string {
  const resolved = resolveHttpUrl(input?.trim() || DEFAULT_API_BASE_URL);

  if (!resolved) {
    throw new CliError(`"${input}" is not a usable http or https address.`);
  }

  const url = new URL(resolved);

  if (url.protocol !== "https:" && !LOOPBACK_HOSTS.has(url.hostname)) {
    throw new CliError(
      "API keys only travel over https. Plain http is allowed for localhost alone.",
    );
  }

  return `${url.origin}${url.pathname}`.replace(/\/+$/, "");
}
