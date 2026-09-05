import type { ChatRun } from "@ngriffin_uk/polychat-schemas";
import { describe, expect, it, vi } from "vitest";

import type { Message } from "~/types";

import { recoverDetachedTurn, resolveAcceptedRunCommand } from "../turn-recovery";

const userMessage = { id: "user-1", role: "user", content: "hello" } as Message;
const assistantMessage = { id: "assistant-1", role: "assistant", content: "hi" } as Message;
const toolMessage = { id: "tool-1", role: "tool", content: "" } as Message;

function run(status: ChatRun["status"] = "running", attempt = 1): ChatRun {
  return {
    protocolVersion: 1,
    id: "run-1",
    conversationId: "conversation-1",
    projectId: null,
    projectTaskId: null,
    initiatorUserId: 7,
    status,
    attempt,
    createdAt: "2026-09-05T12:00:00.000Z",
    updatedAt: "2026-09-05T12:00:01.000Z",
    startedAt: "2026-09-05T12:00:01.000Z",
    completedAt: null,
    terminalReason: null,
    lastMessageId: null,
  };
}

function recover(
  fetchRun: (runId: string) => Promise<{ run: ChatRun; messages: Message[] }>,
  options: { runId?: string; resolveCommand?: () => Promise<string | null> } = {},
) {
  return recoverDetachedTurn({
    runId: options.runId,
    resolveCommand: options.resolveCommand,
    fetchRun,
    pollIntervalMs: 0,
    maxWaitMs: 100,
    wait: async () => {},
    now: (() => {
      let value = 0;

      return () => (value += 10);
    })(),
  });
}

describe("recoverDetachedTurn", () => {
  it("keeps observing the exact run through intermediate assistant and tool steps", async () => {
    const fetchRun = vi
      .fn()
      .mockResolvedValueOnce({ run: run("running"), messages: [userMessage, toolMessage] })
      .mockResolvedValueOnce({
        run: run("running"),
        messages: [userMessage, toolMessage, assistantMessage],
      })
      .mockResolvedValueOnce({
        run: run("succeeded"),
        messages: [userMessage, toolMessage, assistantMessage],
      });

    await expect(recover(fetchRun, { runId: "run-1" })).resolves.toMatchObject({
      run: { status: "succeeded" },
      messages: [userMessage, toolMessage, assistantMessage],
    });
    expect(fetchRun).toHaveBeenCalledTimes(3);
  });

  it("returns a waiting snapshot without requiring an assistant message", async () => {
    const fetchRun = vi.fn().mockResolvedValue({
      run: run("awaiting_approval"),
      messages: [userMessage, toolMessage],
    });

    await expect(recover(fetchRun, { runId: "run-1" })).resolves.toMatchObject({
      run: { status: "awaiting_approval" },
      messages: [userMessage, toolMessage],
    });
  });

  it("resolves the command when the connection was lost before the run receipt arrived", async () => {
    const resolveCommand = vi.fn().mockRejectedValueOnce(new Error("not accepted yet"));

    resolveCommand.mockResolvedValue("run-1");
    const fetchRun = vi.fn().mockResolvedValue({
      run: run("interrupted"),
      messages: [userMessage],
    });

    await expect(recover(fetchRun, { resolveCommand })).resolves.toMatchObject({
      run: { id: "run-1", status: "interrupted" },
    });
    expect(resolveCommand).toHaveBeenCalledTimes(2);
  });

  it("keeps polling when a run snapshot request fails", async () => {
    const fetchRun = vi
      .fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce({ run: run("failed"), messages: [userMessage] });

    await expect(recover(fetchRun, { runId: "run-1" })).resolves.toMatchObject({
      run: { status: "failed" },
    });
  });

  it("classifies the last scheduled exact-run poll for timeout telemetry", async () => {
    const attempts: Array<{ attempt: number; elapsedMs: number; finalAttempt: boolean }> = [];
    let currentTime = 0;

    await recoverDetachedTurn({
      runId: "run-1",
      fetchRun: async (_runId, attempt) => {
        attempts.push(attempt);

        return { run: run("running"), messages: [userMessage] };
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

describe("resolveAcceptedRunCommand", () => {
  it("waits for acceptance instead of falling back to conversation-scoped cancellation", async () => {
    const fetchCommand = vi
      .fn()
      .mockRejectedValueOnce(new Error("not found"))
      .mockResolvedValueOnce({ run: run("running") });

    await expect(
      resolveAcceptedRunCommand({ fetchCommand, intervalMs: 0, wait: async () => {} }),
    ).resolves.toMatchObject({ id: "run-1", attempt: 1 });
    expect(fetchCommand).toHaveBeenCalledTimes(2);
  });
});
