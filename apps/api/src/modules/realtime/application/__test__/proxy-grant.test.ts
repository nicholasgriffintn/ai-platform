import { afterEach, describe, expect, it, vi } from "vitest";

import {
  assertRealtimeProxyGrant,
  createRealtimeProxyGrant,
} from "~/modules/realtime/application/proxy-grant";
import type { IEnv, IUser } from "~/types";

const coordinatorFetch = vi.fn().mockResolvedValue(Response.json({ acquired: true }));
const env = {
  API_BASE_URL: "https://api.polychat.test",
  APP_BASE_URL: "https://polychat.test",
  JWT_SECRET: "a-test-secret-that-is-long-enough-for-hmac",
  REALTIME_PROXY_COORDINATOR: {
    idFromName: vi.fn(() => "user-42"),
    get: vi.fn(() => ({ fetch: coordinatorFetch })),
  },
} as unknown as IEnv;

const user = { id: 42 } as IUser;

async function validGrant() {
  return createRealtimeProxyGrant(env, {
    byok: false,
    model: "scribe-v2",
    provider: "elevenlabs",
    sessionId: "session-1",
    userId: user.id,
  });
}

function proxyRequest(origin = "https://polychat.test") {
  return new Request(
    "https://api.polychat.test/realtime/transcription?provider=elevenlabs&session_id=session-1",
    {
      headers: { Origin: origin },
    },
  );
}

describe("realtime proxy grants", () => {
  afterEach(() => {
    vi.useRealTimers();
    coordinatorFetch.mockClear();
  });

  it("accepts a grant only for its exact user, provider, model and session", async () => {
    const grant = await validGrant();

    await expect(
      assertRealtimeProxyGrant({
        env,
        grant: grant.token,
        model: "scribe-v2",
        provider: "elevenlabs",
        request: proxyRequest(),
        sessionId: "session-1",
        user,
      }),
    ).resolves.toEqual({ byok: false, release: expect.any(Function) });

    await expect(
      assertRealtimeProxyGrant({
        env,
        grant: grant.token,
        model: "different-model",
        provider: "elevenlabs",
        request: proxyRequest(),
        sessionId: "session-1",
        user,
      }),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it("rejects a valid grant from an untrusted browser origin", async () => {
    const grant = await validGrant();

    await expect(
      assertRealtimeProxyGrant({
        env,
        grant: grant.token,
        model: "scribe-v2",
        provider: "elevenlabs",
        request: proxyRequest("https://attacker.example"),
        sessionId: "session-1",
        user,
      }),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it("rejects a grant presented by another authenticated user", async () => {
    const grant = await validGrant();

    await expect(
      assertRealtimeProxyGrant({
        env,
        grant: grant.token,
        model: "scribe-v2",
        provider: "elevenlabs",
        request: proxyRequest(),
        sessionId: "session-1",
        user: { ...user, id: 7 },
      }),
    ).rejects.toMatchObject({ statusCode: 403 });
    expect(coordinatorFetch).not.toHaveBeenCalled();
  });
});
