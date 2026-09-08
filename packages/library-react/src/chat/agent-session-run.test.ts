import type { DesktopAgentSession } from "@ngriffin_uk/polychat-library-chat";
import type { AgentThreadBinding } from "@ngriffin_uk/polychat-schemas";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { agentSessions } from "./agent-session-host.js";
import { streamAgentSessionRun } from "./agent-session-run.js";

interface ScriptedSession {
  session: DesktopAgentSession;
  sent: unknown[];
  push: (message: unknown) => void;
}

function createScriptedSession(threadId: string, directoryPath: string): ScriptedSession {
  const sent: unknown[] = [];
  const waiting: ((line: string | null) => void)[] = [];
  const buffered: string[] = [];
  let closed = false;

  const push = (message: unknown) => {
    const line = JSON.stringify(message);
    const next = waiting.shift();

    if (next) {
      next(line);

      return;
    }

    buffered.push(line);
  };

  const session: DesktopAgentSession = {
    sessionKey: `codex:${directoryPath}`,
    directoryPath,
    head: null,
    adopted: false,
    events: {
      // eslint-disable-next-line require-yield
      async *[Symbol.asyncIterator]() {
        return;
      },
    },
    transport: {
      async *[Symbol.asyncIterator]() {
        while (!closed) {
          const line =
            buffered.shift() ??
            (await new Promise<string | null>((resolve) => waiting.push(resolve)));

          if (line === null) {
            return;
          }

          yield line;
        }
      },
    },
    send: async (payload) => {
      const message = JSON.parse(payload) as { id?: number; method?: string };

      sent.push(message);

      if (message.method === "initialize") {
        push({ id: message.id, result: { userAgent: "codex/test" } });
      }

      if (message.method === "thread/start" || message.method === "thread/resume") {
        push({ id: message.id, result: { thread: { id: threadId } } });
      }

      if (message.method === "turn/start") {
        push({ id: message.id, result: {} });
        push({ method: "item/agentMessage/delta", params: { delta: "done" } });
        push({ method: "turn/completed", params: { turn: { id: "turn-1", status: "completed" } } });
      }
    },
    stop: async () => {
      closed = true;
      waiting.splice(0).forEach((resolve) => resolve(null));
    },
  };

  return { session, sent, push };
}

function createBackend(options: { binding?: AgentThreadBinding; threadId?: string }) {
  const scripted = createScriptedSession(options.threadId ?? "thread-1", "/repo");
  const saved: AgentThreadBinding[] = [];
  let stored = options.binding ?? null;

  return {
    scripted,
    saved,
    backend: {
      probeAgentTool: vi.fn(async () => ({
        state: "ready" as const,
        checkedAt: "2026-09-08T00:00:00Z",
        version: "0.153.4",
      })),
      agentSupportsSessions: vi.fn(async () => true),
      startAgentSession: vi.fn(async () => scripted.session),
      readAgentThread: vi.fn(async () => stored),
      saveAgentThread: vi.fn(async (binding: AgentThreadBinding) => {
        saved.push(binding);
        stored = binding;
      }),
      pickAgentDirectory: vi.fn(async () => "/repo"),
      saveAgentDirectory: vi.fn(async () => ({
        id: "directory-1",
        path: "/repo",
        label: "repo",
        approvedAt: "2026-09-08T00:00:00Z",
        lastUsedAt: null,
        isGitRepo: true,
      })),
    },
  };
}

const model = {
  id: "agent/codex",
  kind: "agent" as const,
  matchingModel: "codex",
  name: "Codex",
};

function runOptions(backend: ReturnType<typeof createBackend>, conversationId: string) {
  return {
    backend: backend.backend as never,
    conversationId,
    messages: [{ role: "user" as const, content: "inspect the repo" }] as never,
    model: model as never,
    onContent: vi.fn(),
    onStatus: vi.fn(),
    signal: new AbortController().signal,
    permissionMode: "auto_accept_edits" as const,
    reasoningEffort: null,
    selectedModel: null,
  };
}

describe("streamAgentSessionRun", () => {
  beforeEach(async () => {
    await agentSessions.release({
      conversationId: "conversation-1",
      driver: "codex",
      directoryId: "directory-1",
    });
  });

  it("asks for a folder once and remembers it with the native thread", async () => {
    const harness = createBackend({});
    const options = runOptions(harness, "conversation-1");

    const text = await streamAgentSessionRun(options);

    expect(text).toBe("done");
    expect(harness.backend.pickAgentDirectory).toHaveBeenCalledTimes(1);
    expect(harness.saved.at(-1)).toMatchObject({
      conversationId: "conversation-1",
      driver: "codex",
      directoryId: "directory-1",
      threadId: "thread-1",
      permissionMode: "auto_accept_edits",
    });
  });

  it("resumes the stored thread instead of picking a folder again", async () => {
    const harness = createBackend({
      binding: {
        conversationId: "conversation-1",
        driver: "codex",
        directoryId: "directory-1",
        threadId: "thread-1",
        model: null,
        reasoningEffort: null,
        permissionMode: "auto_accept_edits",
        updatedAt: "2026-09-08T00:00:00Z",
      },
    });

    await streamAgentSessionRun(runOptions(harness, "conversation-1"));

    expect(harness.backend.pickAgentDirectory).not.toHaveBeenCalled();
    expect(
      harness.scripted.sent.some(
        (message) => (message as { method?: string }).method === "thread/resume",
      ),
    ).toBe(true);
  });

  it("refuses to adopt a thread that belongs to another driver", async () => {
    const harness = createBackend({
      binding: {
        conversationId: "conversation-1",
        driver: "claude-code",
        directoryId: "directory-9",
        threadId: "someone-elses-thread",
        model: null,
        reasoningEffort: null,
        permissionMode: "auto",
        updatedAt: "2026-09-08T00:00:00Z",
      },
    });

    await streamAgentSessionRun(runOptions(harness, "conversation-1"));

    expect(harness.backend.pickAgentDirectory).toHaveBeenCalledTimes(1);
    expect(
      harness.scripted.sent.some(
        (message) => (message as { method?: string }).method === "thread/start",
      ),
    ).toBe(true);
  });

  it("reports a failed turn rather than returning partial text", async () => {
    const harness = createBackend({});
    const options = runOptions(harness, "conversation-1");
    const originalSend = harness.scripted.session.send;

    harness.scripted.session.send = async (payload: string) => {
      const message = JSON.parse(payload) as { id?: number; method?: string };

      if (message.method === "turn/start") {
        harness.scripted.push({ id: message.id, result: {} });
        harness.scripted.push({
          method: "turn/completed",
          params: {
            turn: { id: "turn-1", status: "failed", error: { message: "the sandbox refused" } },
          },
        });

        return;
      }

      await originalSend(payload);
    };

    await expect(streamAgentSessionRun(options)).rejects.toThrow("the sandbox refused");
  });
});
