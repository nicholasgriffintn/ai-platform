import type { ThreadCoordinatorState, ThreadInstruction } from "@ngriffin_uk/polychat-schemas";
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

function submit(coordinator: any, kind: string) {
  return coordinator.fetch(
    new Request("https://coordinator/instructions", {
      method: "POST",
      body: JSON.stringify({ kind }),
    }),
  );
}

function acquire(coordinator: any, kind: string) {
  return coordinator.fetch(
    new Request("https://coordinator/acquire", {
      method: "POST",
      body: JSON.stringify({ kind }),
    }),
  );
}

async function readState(coordinator: any): Promise<ThreadCoordinatorState> {
  const response = await coordinator.fetch(new Request("https://coordinator/state"));

  return response.json();
}

describe("ConversationCoordinator", () => {
  it("keeps both instructions when two are submitted concurrently", async () => {
    const coordinator = createCoordinator();

    await Promise.all([submit(coordinator, "user_message"), submit(coordinator, "compact")]);

    const state = await readState(coordinator);

    expect(state.queue.map((instruction: ThreadInstruction) => instruction.kind)).toEqual([
      "user_message",
      "compact",
    ]);
  });

  it("gives every concurrently queued instruction a distinct index", async () => {
    const coordinator = createCoordinator();

    await Promise.all([
      submit(coordinator, "user_message"),
      submit(coordinator, "user_message"),
      submit(coordinator, "user_message"),
    ]);

    const state = await readState(coordinator);
    const indexes = state.queue.map((instruction: ThreadInstruction) => instruction.index);

    expect(new Set(indexes).size).toBe(3);
  });

  it("lets only one of two concurrent acquisitions take the thread", async () => {
    const coordinator = createCoordinator();

    const [first, second] = await Promise.all([
      acquire(coordinator, "user_message").then((response: Response) => response.json()),
      acquire(coordinator, "compact").then((response: Response) => response.json()),
    ]);

    expect([first.acquired, second.acquired].filter(Boolean)).toHaveLength(1);
  });

  it("hands a queued instruction to only one of two concurrent claims", async () => {
    const coordinator = createCoordinator();

    await submit(coordinator, "user_message");

    const claim = (): Promise<{ instruction: ThreadInstruction | null }> =>
      coordinator
        .fetch(new Request("https://coordinator/claim", { method: "POST" }))
        .then((response: Response) => response.json());

    const [first, second] = await Promise.all([claim(), claim()]);
    const claimed = [first.instruction, second.instruction].filter(Boolean);

    expect(claimed).toHaveLength(1);
    expect((await readState(coordinator)).queue).toEqual([]);
  });
});
