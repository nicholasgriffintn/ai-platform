import { describe, expect, it, vi } from "vitest";

vi.mock("agents", () => ({
  Agent: class {
    constructor(
      public ctx: unknown,
      public env: unknown,
    ) {}
  },
}));

const { MAX_REALTIME_PROXY_SESSIONS_PER_USER, RealtimeProxyCoordinator } =
  await import("../object");

function createCoordinator() {
  const data = new Map<string, unknown>();
  let lock = Promise.resolve();
  const ctx = {
    storage: {
      delete: async (keys: string | string[]) => {
        for (const key of Array.isArray(keys) ? keys : [keys]) {
          data.delete(key);
        }
      },
      get: async (key: string) => data.get(key),
      list: async ({ prefix }: { prefix: string }) =>
        new Map([...data].filter(([key]) => key.startsWith(prefix))),
      put: async (key: string, value: unknown) => data.set(key, value),
    },
    blockConcurrencyWhile: <T>(task: () => Promise<T>): Promise<T> => {
      const run = lock.then(task);

      lock = run.then(
        () => undefined,
        () => undefined,
      );

      return run;
    },
  };

  return new RealtimeProxyCoordinator(ctx as never, {} as never);
}

function consume(coordinator: InstanceType<typeof RealtimeProxyCoordinator>, jti: string) {
  return coordinator.fetch(
    new Request("https://coordinator/consume", {
      method: "POST",
      body: JSON.stringify({
        expiresAt: Date.now() + 60_000,
        jti,
        sessionExpiresAt: Date.now() + 900_000,
        sessionId: `session-${jti}`,
      }),
    }),
  );
}

function release(coordinator: InstanceType<typeof RealtimeProxyCoordinator>, jti: string) {
  return coordinator.fetch(
    new Request("https://coordinator/release", {
      method: "POST",
      body: JSON.stringify({ jti }),
    }),
  );
}

describe("RealtimeProxyCoordinator", () => {
  it("atomically consumes a grant once under concurrent replay", async () => {
    const coordinator = createCoordinator();
    const results: { acquired?: boolean; reason?: string }[] = await Promise.all([
      consume(coordinator, "grant-1").then((response) => response.json()),
      consume(coordinator, "grant-1").then((response) => response.json()),
    ]);

    expect(results.filter((result) => result.acquired)).toHaveLength(1);
    expect(results).toContainEqual({ acquired: false, reason: "replayed" });
  });

  it("consumes a refused grant when the per-user session limit is reached", async () => {
    const coordinator = createCoordinator();

    await Promise.all(
      Array.from({ length: MAX_REALTIME_PROXY_SESSIONS_PER_USER }, (_, index) =>
        consume(coordinator, `active-${index}`),
      ),
    );

    await expect(
      consume(coordinator, "limited").then((response) => response.json()),
    ).resolves.toEqual({ acquired: false, reason: "concurrency" });
    await expect(
      consume(coordinator, "limited").then((response) => response.json()),
    ).resolves.toEqual({ acquired: false, reason: "replayed" });
  });

  it("admits another session after an active socket reservation is released", async () => {
    const coordinator = createCoordinator();

    await Promise.all(
      Array.from({ length: MAX_REALTIME_PROXY_SESSIONS_PER_USER }, (_, index) =>
        consume(coordinator, `active-${index}`),
      ),
    );

    await release(coordinator, "active-0");

    await expect(
      consume(coordinator, "replacement").then((response) => response.json()),
    ).resolves.toEqual({ acquired: true });
  });
});
