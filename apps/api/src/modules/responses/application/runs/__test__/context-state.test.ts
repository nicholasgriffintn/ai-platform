import type {
  ChatContextSnapshot,
  ChatRun,
  ChatRunCommandReceipt,
} from "@ngriffin_uk/polychat-schemas";
import { describe, expect, it, vi } from "vitest";

import { createChatContextPublisher } from "../context-state";

const run: ChatRun = {
  protocolVersion: 1,
  id: "run-1",
  conversationId: "conversation-1",
  projectId: null,
  projectTaskId: null,
  initiatorUserId: 42,
  trigger: "user",
  status: "running",
  attempt: 1,
  createdAt: "2026-10-14T12:00:00.000Z",
  updatedAt: "2026-10-14T12:00:00.000Z",
  startedAt: "2026-10-14T12:00:00.000Z",
  completedAt: null,
  terminalReason: null,
  lastMessageId: null,
  context: null,
  retry: null,
};

const snapshot: ChatContextSnapshot = {
  protocolVersion: 1,
  runId: "run-1",
  conversationId: "conversation-1",
  attempt: 1,
  step: 2,
  model: "model-1",
  generatedAt: "2026-10-14T12:00:01.000Z",
  usage: { inputTokens: 5597, contextWindow: 262144, source: "reported" },
  breakdown: [{ kind: "conversation", tokens: 5597 }],
  messages: { included: 6, omitted: 0 },
  sources: [],
  skills: [],
  summary: null,
  omissions: [],
};

describe("createChatContextPublisher", () => {
  it("streams the run with its freshly recorded context so the client never shows a blank step", async () => {
    const receipt: ChatRunCommandReceipt = {
      protocolVersion: 1,
      commandId: "command-1",
      run,
      kind: "turn",
      acceptedAt: run.createdAt,
      duplicate: false,
    };
    const recordContext = vi.fn(async (next: ChatContextSnapshot) => {
      receipt.run = { ...run, context: next };

      return receipt.run;
    });
    const write = vi.fn(async (_event: unknown) => undefined);
    const publish = createChatContextPublisher({
      sink: { write },
      runLifecycle: { receipt, recordContext },
    });

    await publish?.(snapshot);

    expect(recordContext).toHaveBeenCalledWith(snapshot);
    expect(write).toHaveBeenCalledOnce();
    expect(write.mock.calls[0]?.[0]).toMatchObject({
      type: "response.in_progress",
      response: { id: "run-1", context: snapshot },
    });
  });

  it("leaves unstored runs to the caller's own handler", () => {
    expect(createChatContextPublisher({ sink: { write: vi.fn() } })).toBeUndefined();
  });
});
