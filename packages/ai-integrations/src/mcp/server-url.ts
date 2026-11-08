import { parsePublicHttpUrl, UnsafeUrlError } from "@ngriffin_uk/polychat-utility-server/http";

import { McpRequestError } from "./errors.js";

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

function parseLoopbackUrl(input: string): URL | undefined {
  if (!URL.canParse(input)) {
    return undefined;
  }

  const url = new URL(input);

  return LOOPBACK_HOSTS.has(url.hostname) &&
    (url.protocol === "http:" || url.protocol === "https:") &&
    !url.username &&
    !url.password
    ? url
    : undefined;
}

export function parseMcpServerUrl(
  input: string,
  operation = "connect",
  options: { allowLoopback?: boolean } = {},
): URL {
  const loopback = options.allowLoopback ? parseLoopbackUrl(input) : undefined;

  if (loopback) {
    return loopback;
  }

  try {
    const url = parsePublicHttpUrl(input);

    if (url.protocol !== "https:") {
      throw new UnsafeUrlError(url.toString());
    }

    return url;
  } catch {
    throw new McpRequestError({
      code: "unsafe_url",
      operation,
      message: "MCP servers must be public HTTPS endpoints without embedded credentials.",
      requestSent: false,
    });
  }
}
