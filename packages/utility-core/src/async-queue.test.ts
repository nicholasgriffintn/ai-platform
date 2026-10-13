import { describe, expect, it } from "vitest";

import { createAsyncEventQueue, createConcurrencyLimiter } from "./async-queue";

async function drain<T>(events: AsyncIterable<T>): Promise<T[]> {
  const seen: T[] = [];

  for await (const value of events) {
    seen.push(value);
  }

  return seen;
}

describe("createAsyncEventQueue", () => {
  it("delivers values buffered before anything started reading", async () => {
    const queue = createAsyncEventQueue<number>();

    queue.push(1);
    queue.push(2);
    queue.close();

    await expect(drain(queue.events)).resolves.toEqual([1, 2]);
  });

  it("delivers values pushed while a reader is already waiting", async () => {
    const queue = createAsyncEventQueue<string>();
    const drained = drain(queue.events);

    queue.push("a");
    queue.push("b");
    queue.close();

    await expect(drained).resolves.toEqual(["a", "b"]);
  });

  it("ends the iteration when the queue closes with a reader waiting", async () => {
    const queue = createAsyncEventQueue<string>();
    const drained = drain(queue.events);

    queue.close();

    await expect(drained).resolves.toEqual([]);
  });

  it("drops values pushed after close rather than delivering them late", async () => {
    const queue = createAsyncEventQueue<number>();

    queue.push(1);
    queue.close();
    queue.push(2);

    await expect(drain(queue.events)).resolves.toEqual([1]);
  });
});

describe("createConcurrencyLimiter", () => {
  it("never runs more tasks at once than the limit and still finishes them all", async () => {
    const run = createConcurrencyLimiter(2);
    let active = 0;
    let peak = 0;
    const task = (value: number) => async () => {
      active += 1;
      peak = Math.max(peak, active);
      await new Promise((resolve) => setTimeout(resolve, 1));
      active -= 1;

      return value;
    };

    const results = await Promise.all([1, 2, 3, 4, 5].map((value) => run(task(value))));

    expect(results).toEqual([1, 2, 3, 4, 5]);
    expect(peak).toBe(2);
  });
});
