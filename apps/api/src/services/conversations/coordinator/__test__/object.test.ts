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

function acquire(coordinator: any, kind: string) {
  return coordinator.fetch(
    new Request("https://coordinator/acquire", {
      method: "POST",
      body: JSON.stringify({ kind }),
    }),
  );
}

describe("ConversationCoordinator", () => {
  it("lets only one of two concurrent acquisitions take the thread", async () => {
    const coordinator = createCoordinator();

    const [first, second] = await Promise.all([
      acquire(coordinator, "user_message").then((response: Response) => response.json()),
      acquire(coordinator, "compact").then((response: Response) => response.json()),
    ]);

    expect([first.acquired, second.acquired].filter(Boolean)).toHaveLength(1);
  });
});
