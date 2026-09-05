import { describe, expect, it, vi } from "vitest";

import type { Message } from "~/types";

import { recoverDetachedTurn } from "../turn-recovery";

const userMessage = { id: "user-1", role: "user", content: "hello" } as Message;
const assistantMessage = { id: "assistant-1", role: "assistant", content: "hi" } as Message;
const toolMessage = { id: "tool-1", role: "tool", content: "" } as Message;

function recover(fetchMessages: (completionId: string) => Promise<Message[]>) {
  return recoverDetachedTurn({
    completionId: "completion-1",
    knownMessageIds: new Set(["user-1"]),
    fetchMessages,
    pollIntervalMs: 0,
    maxWaitMs: 50,
    wait: async () => {},
    now: (() => {
      let value = 0;

      return () => (value += 10);
    })(),
  });
}

describe("recoverDetachedTurn", () => {
  it("returns the messages that landed once the detached turn persists an answer", async () => {
    const fetchMessages = vi
      .fn()
      .mockResolvedValueOnce([userMessage])
      .mockResolvedValueOnce([userMessage, toolMessage, assistantMessage]);

    await expect(recover(fetchMessages)).resolves.toEqual([toolMessage, assistantMessage]);
  });

  it("keeps waiting while only tool messages have landed", async () => {
    const fetchMessages = vi.fn().mockResolvedValue([userMessage, toolMessage]);

    await expect(recover(fetchMessages)).resolves.toEqual([]);
    expect(fetchMessages.mock.calls.length).toBeGreaterThan(1);
  });

  it("keeps polling when a poll fails", async () => {
    const fetchMessages = vi
      .fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce([userMessage, assistantMessage]);

    await expect(recover(fetchMessages)).resolves.toEqual([assistantMessage]);
  });

  it("classifies the last scheduled poll for timeout telemetry", async () => {
    const attempts: Array<{ attempt: number; elapsedMs: number; finalAttempt: boolean }> = [];
    let currentTime = 0;

    await recoverDetachedTurn({
      completionId: "completion-1",
      knownMessageIds: new Set(["user-1"]),
      fetchMessages: async (_completionId, attempt) => {
        attempts.push(attempt);

        return [userMessage];
      },
      pollIntervalMs: 20,
      maxWaitMs: 50,
      wait: async (ms) => {
        currentTime += ms;
      },
      now: () => currentTime,
    });

    expect(attempts).toEqual([
      { attempt: 1, elapsedMs: 20, finalAttempt: false },
      { attempt: 2, elapsedMs: 40, finalAttempt: true },
    ]);
  });
});
