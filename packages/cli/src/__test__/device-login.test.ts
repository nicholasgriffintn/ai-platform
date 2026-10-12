import { describe, expect, it } from "vitest";

import { waitForDeviceApproval } from "../device-login.js";
import type { Fetch } from "../http.js";

function scriptedFetch(responses: Array<{ status: number; body: unknown }>): Fetch {
  const queue = [...responses];

  return async () => {
    const next = queue.shift();

    if (!next) {
      throw new Error("No more scripted responses");
    }

    return new Response(JSON.stringify(next.body), { status: next.status });
  };
}

function run(responses: Array<{ status: number; body: unknown }>, expiresInSeconds = 600) {
  let clock = 0;
  const sleeps: number[] = [];
  const result = waitForDeviceApproval({
    fetch: scriptedFetch(responses),
    apiBaseUrl: "https://api.polychat.test",
    deviceCode: "device-code",
    intervalSeconds: 10,
    expiresInSeconds,
    sleep: async (milliseconds) => {
      sleeps.push(milliseconds);
      clock += milliseconds;
    },
    now: () => clock,
  });

  return { result, sleeps };
}

describe("waitForDeviceApproval", () => {
  it("keeps polling while pending and backs off when told to slow down", async () => {
    const { result, sleeps } = run([
      { status: 400, body: { error: "authorization_pending" } },
      { status: 400, body: { error: "slow_down" } },
      { status: 200, body: { access_token: "pk_123", token_type: "Bearer" } },
    ]);

    await expect(result).resolves.toBe("pk_123");
    expect(sleeps).toEqual([10_000, 10_000, 15_000]);
  });

  it("stops with a clear message when the person denies the request", async () => {
    const { result } = run([{ status: 400, body: { error: "access_denied" } }]);

    await expect(result).rejects.toThrow("Sign-in was refused");
  });

  it("gives up once the code has expired locally", async () => {
    const { result } = run([{ status: 400, body: { error: "authorization_pending" } }], 15);

    await expect(result).rejects.toThrow("expired");
  });

  it("surfaces the server message for errors outside the device flow", async () => {
    const { result } = run([{ status: 503, body: { status: "error", message: "Not configured" } }]);

    await expect(result).rejects.toThrow("Checking for approval failed: Not configured");
  });
});
