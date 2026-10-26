import { afterEach, describe, expect, it, vi } from "vitest";

import {
  assertRealtimeProxyGrant,
  connectReservedRealtimeProxy,
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

  it("rejects requests sent to a host outside the configured API origin", async () => {
    const grant = await validGrant();

    await expect(
      assertRealtimeProxyGrant({
        env,
        grant: grant.token,
        model: "scribe-v2",
        provider: "elevenlabs",
        request: new Request("https://attacker.example/realtime/elevenlabs/transcription"),
        sessionId: "session-1",
        user,
      }),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it("accepts the route host wrangler dev rewrites to while still checking the origin", async () => {
    const developmentEnv = {
      ...env,
      ENV: "development",
      API_BASE_URL: "http://localhost:8787",
      APP_BASE_URL: "http://localhost:5173",
    } as unknown as IEnv;
    const grant = await createRealtimeProxyGrant(developmentEnv, {
      byok: false,
      model: "scribe-v2",
      provider: "elevenlabs",
      sessionId: "session-1",
      userId: user.id,
    });
    const request = (origin: string) =>
      new Request("https://api.polychat.app/realtime/transcription", {
        headers: { Host: "api.polychat.app", Origin: origin },
      });
    const assertGrant = (origin: string) =>
      assertRealtimeProxyGrant({
        env: developmentEnv,
        grant: grant.token,
        model: "scribe-v2",
        provider: "elevenlabs",
        request: request(origin),
        sessionId: "session-1",
        user,
      });

    coordinatorFetch.mockResolvedValueOnce(Response.json({ acquired: true }));

    await expect(assertGrant("http://localhost:5173")).resolves.toMatchObject({ byok: false });
    await expect(assertGrant("https://attacker.example")).rejects.toMatchObject({
      statusCode: 403,
    });
  });

  it("rejects a mismatched Host header", async () => {
    const grant = await validGrant();

    await expect(
      assertRealtimeProxyGrant({
        env,
        grant: grant.token,
        model: "scribe-v2",
        provider: "elevenlabs",
        request: new Request("https://api.polychat.test/realtime/elevenlabs/transcription", {
          headers: { Host: "attacker.example", Origin: "https://polychat.test" },
        }),
        sessionId: "session-1",
        user,
      }),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it("rejects an expired grant", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-31T12:00:00.000Z"));
    const grant = await validGrant();

    vi.advanceTimersByTime(61_000);

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
    ).rejects.toMatchObject({ statusCode: 401 });
    expect(coordinatorFetch).not.toHaveBeenCalled();
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

  it("releases an active reservation when the provider handshake fails", async () => {
    const release = vi.fn().mockResolvedValue(undefined);

    await expect(
      connectReservedRealtimeProxy(
        { byok: false, release },
        async () => new Response("failed", { status: 502 }),
      ),
    ).resolves.toMatchObject({ status: 502 });
    expect(release).toHaveBeenCalledOnce();
  });

  it("settles on the measured audio before releasing a finished session", async () => {
    const release = vi.fn().mockResolvedValue(undefined);
    const settle = vi.fn().mockResolvedValue(undefined);
    const order: string[] = [];

    release.mockImplementation(async () => {
      order.push("release");
    });
    settle.mockImplementation(async () => {
      order.push("settle");
    });

    await connectReservedRealtimeProxy(
      { byok: true, release },
      async (onSessionEnd) => {
        await onSessionEnd({ audioBytes: 64_000, audioSeconds: 2 });

        return { status: 101 } as Response;
      },
      settle,
    );

    expect(settle).toHaveBeenCalledWith({ audioBytes: 64_000, audioSeconds: 2 });
    expect(order).toEqual(["settle", "release"]);
    expect(release).toHaveBeenCalledOnce();
  });
});
