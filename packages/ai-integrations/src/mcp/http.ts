import type { FetchLike } from "@modelcontextprotocol/client";
import { integrationEndpointSchema } from "@ngriffin_uk/polychat-schemas";
import { limitResponseBody } from "@ngriffin_uk/polychat-utility-server/http";

export const MAX_NATIVE_MCP_BYTES = 2 * 1024 * 1024;

export function createNativeMcpFetch(
  endpoint: string,
  token: string | undefined,
  signal: AbortSignal,
): FetchLike {
  const expected = new URL(integrationEndpointSchema.parse(endpoint));

  return async (input, init) => {
    const target = new URL(input.toString());

    if (target.href !== expected.href) {
      throw new Error("The MCP transport requested an unreviewed endpoint");
    }

    const headers = new Headers(init?.headers);

    headers.delete("cookie");
    headers.delete("proxy-authorization");

    if (token) {
      headers.set("authorization", `Bearer ${token}`);
    } else {
      headers.delete("authorization");
    }

    const response = await fetch(expected, {
      ...init,
      headers,
      credentials: "omit",
      redirect: "manual",
      signal: init?.signal ? AbortSignal.any([signal, init.signal]) : signal,
    });

    if (response.status >= 300 && response.status < 400) {
      await response.body?.cancel();
      throw new Error("MCP endpoint redirects require a new reviewed definition");
    }

    return limitResponseBody(response, MAX_NATIVE_MCP_BYTES);
  };
}
