import { parsePublicHttpUrl, UnsafeUrlError } from "@ngriffin_uk/polychat-utility-server/http";

import { McpRequestError } from "./errors.js";

export function parseMcpServerUrl(input: string, operation = "connect"): URL {
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
