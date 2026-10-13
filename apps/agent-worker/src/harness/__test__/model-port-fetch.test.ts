import { afterAll, describe, expect, it, vi } from "vitest";

import { MODEL_PORT_SESSION_HEADER, registerModelPort } from "../model-port-fetch";
import { POLYCHAT_MODEL_BASE_URL } from "../polychat-model";

const originalFetch = globalThis.fetch;
const outbound = vi.fn(async () => new Response("outbound"));

globalThis.fetch = outbound;

afterAll(() => {
  globalThis.fetch = originalFetch;
});

describe("registerModelPort", () => {
  it("routes model port calls to their session and leaves other traffic alone", async () => {
    const first = vi.fn(async (input: RequestInfo | URL) => {
      const request = new Request(input);

      return new Response(`first:${request.headers.has(MODEL_PORT_SESSION_HEADER)}`);
    });
    const second = vi.fn(async () => new Response("second"));

    registerModelPort("session-a", first);
    registerModelPort("session-b", second);

    const routed = await fetch(`${POLYCHAT_MODEL_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: { [MODEL_PORT_SESSION_HEADER]: "session-a" },
      body: "{}",
    });
    const unknown = await fetch(`${POLYCHAT_MODEL_BASE_URL}/chat/completions`, {
      headers: { [MODEL_PORT_SESSION_HEADER]: "session-z" },
    });
    const elsewhere = await fetch("https://example.com/");

    expect(await routed.text()).toBe("first:false");
    expect(second).not.toHaveBeenCalled();
    expect(unknown.status).toBe(404);
    expect(await elsewhere.text()).toBe("outbound");
    expect(outbound).toHaveBeenCalledTimes(1);
  });
});
