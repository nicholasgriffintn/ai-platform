import { QueryClient } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createInvalidationQueue } from "./invalidation-queue.js";

function createQueue(windowMs = 400) {
  const queryClient = new QueryClient();
  const keys: unknown[] = [];

  vi.spyOn(queryClient, "invalidateQueries").mockImplementation(async (filters) => {
    keys.push(filters?.queryKey);
  });

  return { queue: createInvalidationQueue(queryClient, windowMs), keys };
}

describe("sync invalidation queue", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("collapses repeats of the same key into one refetch", () => {
    const { queue, keys } = createQueue();

    queue.push(["chats", "abc"]);
    queue.push(["chats", "abc"]);
    queue.push(["chats", "abc"]);
    vi.advanceTimersByTime(400);

    expect(keys).toEqual([["chats", "abc"]]);
  });

  it("keeps distinct keys", () => {
    const { queue, keys } = createQueue();

    queue.push(["chats", "abc"]);
    queue.push(["chats", "remote"]);
    vi.advanceTimersByTime(400);

    expect(keys).toHaveLength(2);
  });

  it("does not invalidate before the window closes", () => {
    const { queue, keys } = createQueue();

    queue.push(["chats", "abc"]);
    vi.advanceTimersByTime(100);

    expect(keys).toHaveLength(0);
  });

  it("drops pending work when disposed", () => {
    const { queue, keys } = createQueue();

    queue.push(["chats", "abc"]);
    queue.dispose();
    vi.advanceTimersByTime(400);

    expect(keys).toHaveLength(0);
  });
});
