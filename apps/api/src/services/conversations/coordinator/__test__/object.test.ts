import { describe, expect, it, vi } from "vitest";

vi.mock("agents", () => ({
  Agent: class {
    constructor(
      public ctx: any,
      public env: any,
    ) {}
  },
}));

const { ConversationCoordinator } = await import("../object");

/**
 * A Durable Object is single-threaded but still interleaves concurrent fetches at
 * every await, so storage here yields on each call. Without that, a test cannot tell
 * an atomic read-modify-write apart from a racy one.
 */
function createCoordinator() {
  const data = new Map<string, unknown>();
  let lock = Promise.resolve();

  const ctx = {
    storage: {
      get: async (key: string) => {
        await Promise.resolve();

        return data.get(key);
      },
      put: async (key: string, value: unknown) => {
        await Promise.resolve();
        data.set(key, value);
      },
    },
    blockConcurrencyWhile: <T>(task: () => Promise<T>): Promise<T> => {
      const run = lock.then(async () => task());

      lock = run.then(
        () => undefined,
        () => undefined,
      );

      return run;
    },
  };

  return new ConversationCoordinator(ctx as never, {} as never);
}

function acquire(coordinator: any, kind: string, ownerToken = "owner-1") {
  return coordinator.fetch(
    new Request("https://coordinator/acquire", {
      method: "POST",
      body: JSON.stringify({ kind, ownerToken }),
    }),
  );
}

function release(coordinator: any, ownerToken = "owner-1") {
  return coordinator.fetch(
    new Request("https://coordinator/release", {
      method: "POST",
      body: JSON.stringify({ ownerToken }),
    }),
  );
}

function ownerCall(coordinator: any, path: "assert" | "renew", ownerToken = "owner-1") {
  return coordinator.fetch(
    new Request(`https://coordinator/${path}`, {
      method: "POST",
      body: JSON.stringify({ ownerToken }),
    }),
  );
}

describe("ConversationCoordinator", () => {
  it("reports a detached turn until release without taking or extending its lock", async () => {
    const coordinator = createCoordinator();

    await acquire(coordinator, "user_message");
    const response = await coordinator.fetch(
      new Request("https://coordinator/status", { method: "POST" }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      status: "running",
      currentOperation: "user_message",
    });
    await release(coordinator);
    const finished = await coordinator.fetch(
      new Request("https://coordinator/status", { method: "POST" }),
    );

    expect(await finished.json()).toMatchObject({ status: "idle", currentOperation: null });
  });

  it("stops reporting abandoned turns after their lease expires", async () => {
    vi.useFakeTimers();
    try {
      const coordinator = createCoordinator();

      await acquire(coordinator, "user_message");
      vi.advanceTimersByTime(5 * 60 * 1000);
      const response = await coordinator.fetch(
        new Request("https://coordinator/status", { method: "POST" }),
      );

      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({ status: "idle", currentOperation: null });
    } finally {
      vi.useRealTimers();
    }
  });

  it("lets only one of two concurrent acquisitions take the thread", async () => {
    const coordinator = createCoordinator();

    const [first, second] = await Promise.all([
      acquire(coordinator, "user_message").then((response: Response) => response.json()),
      acquire(coordinator, "compact").then((response: Response) => response.json()),
    ]);

    expect([first.acquired, second.acquired].filter(Boolean)).toHaveLength(1);
  });

  it("frees the thread when the holder releases it", async () => {
    const coordinator = createCoordinator();

    await acquire(coordinator, "user_message");
    await release(coordinator);

    const second = await acquire(coordinator, "edit_messages").then((response: Response) =>
      response.json(),
    );

    expect(second.acquired).toBe(true);
  });

  it("refuses an operation it does not recognise", async () => {
    const coordinator = createCoordinator();

    const response = await acquire(coordinator, "not_a_thread_operation");

    expect(response.status).toBe(400);
  });

  it("refuses acquisition and release without an owner token", async () => {
    const coordinator = createCoordinator();
    const acquisition = await coordinator.fetch(
      new Request("https://coordinator/acquire", {
        method: "POST",
        body: JSON.stringify({ kind: "compact" }),
      }),
    );
    const releaseResponse = await coordinator.fetch(
      new Request("https://coordinator/release", {
        method: "POST",
        body: JSON.stringify({}),
      }),
    );

    expect(acquisition.status).toBe(400);
    expect(releaseResponse.status).toBe(400);
  });

  it("does not let an expired owner release a successor lease", async () => {
    vi.useFakeTimers();
    try {
      const coordinator = createCoordinator();

      await acquire(coordinator, "user_message", "owner-old");
      vi.advanceTimersByTime(5 * 60 * 1000);
      await acquire(coordinator, "edit_messages", "owner-new");

      const staleRelease = await release(coordinator, "owner-old");
      const status = await coordinator.fetch(
        new Request("https://coordinator/status", { method: "POST" }),
      );

      expect(await staleRelease.json()).toEqual({ released: false });
      expect(await status.json()).toMatchObject({
        status: "running",
        currentOperation: "edit_messages",
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it("renews a live lease so work can continue beyond five minutes", async () => {
    vi.useFakeTimers();
    try {
      const coordinator = createCoordinator();

      await acquire(coordinator, "user_message");
      vi.advanceTimersByTime(4 * 60 * 1000);
      const renewal = await ownerCall(coordinator, "renew");
      vi.advanceTimersByTime(4 * 60 * 1000);
      const status = await coordinator.fetch(
        new Request("https://coordinator/status", { method: "POST" }),
      );

      expect(await renewal.json()).toMatchObject({ renewed: true });
      expect(await status.json()).toMatchObject({
        status: "running",
        currentOperation: "user_message",
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it("refreshes a current owner's lease at the commit fence", async () => {
    vi.useFakeTimers();
    try {
      const coordinator = createCoordinator();

      await acquire(coordinator, "user_message");
      vi.advanceTimersByTime(4 * 60 * 1000);
      const ownership = await ownerCall(coordinator, "assert");
      vi.advanceTimersByTime(4 * 60 * 1000);
      const status = await coordinator.fetch(
        new Request("https://coordinator/status", { method: "POST" }),
      );

      expect(await ownership.json()).toMatchObject({ owned: true });
      expect(await status.json()).toMatchObject({ status: "running" });
    } finally {
      vi.useRealTimers();
    }
  });

  it("rejects stale renewal and ownership checks without exposing the successor token", async () => {
    vi.useFakeTimers();
    try {
      const coordinator = createCoordinator();

      await acquire(coordinator, "user_message", "owner-old");
      vi.advanceTimersByTime(5 * 60 * 1000);
      await acquire(coordinator, "edit_messages", "owner-new");

      const staleRenewal = await ownerCall(coordinator, "renew", "owner-old");
      const staleOwnership = await ownerCall(coordinator, "assert", "owner-old");
      const status = await coordinator.fetch(
        new Request("https://coordinator/status", { method: "POST" }),
      );
      const statusBody = await status.json();

      expect(await staleRenewal.json()).toEqual({ renewed: false });
      expect(await staleOwnership.json()).toEqual({ owned: false });
      expect(statusBody).toMatchObject({ status: "running", currentOperation: "edit_messages" });
      expect(statusBody).not.toHaveProperty("ownerToken");
    } finally {
      vi.useRealTimers();
    }
  });
});
