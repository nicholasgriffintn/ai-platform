import { A2A_ERRORS, type PlatformResponse } from "@ngriffin_uk/polychat-schemas";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";

import { handleA2aRequest, readA2aMessageText } from "../server";

const runs = vi.hoisted(() => ({
  start: vi.fn(),
  read: vi.fn(),
  followUp: vi.fn(),
  cancel: vi.fn(),
  home: vi.fn(async () => "conversation-1"),
}));

vi.mock("~/modules/teammates/application/external-runs", () => ({
  startExternalTeammateResponse: runs.start,
  readExternalTeammateResponse: runs.read,
  followUpExternalTeammateResponse: runs.followUp,
  cancelExternalTeammateResponse: runs.cancel,
  teammateHomeConversationId: runs.home,
}));

function response(overrides: Partial<PlatformResponse> = {}): PlatformResponse {
  return {
    object: "response",
    id: "response-1",
    conversation_id: "conversation-1",
    status: "completed",
    waiting_on: null,
    attempt: 1,
    trigger: "channel",
    initiator_user_id: 1,
    project_id: null,
    project_task_id: null,
    created_at: "2026-10-23T10:00:00.000Z",
    updated_at: "2026-10-23T10:00:05.000Z",
    started_at: "2026-10-23T10:00:00.000Z",
    completed_at: "2026-10-23T10:00:05.000Z",
    terminal_reason: null,
    last_item_id: "item-1",
    output: [
      {
        type: "message",
        id: "item-1",
        role: "assistant",
        content: [{ type: "text", text: "Here is the summary" }],
      },
    ],
    ...overrides,
  };
}

const context: ServiceContext = Object.create(null);

function rpc(method: string, params?: unknown) {
  return handleA2aRequest({
    context,
    teammateId: "teammate-1",
    payload: { jsonrpc: "2.0", id: 1, method, params },
  });
}

const send = (message: Record<string, unknown>) =>
  rpc("message/send", {
    message: {
      messageId: "m-1",
      role: "user",
      parts: [{ kind: "text", text: "Hello" }],
      ...message,
    },
  });

describe("A2A teammates", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("joins text and data parts, and refuses files and agent-authored messages", () => {
    expect(
      readA2aMessageText({
        kind: "message",
        messageId: "m-1",
        role: "user",
        parts: [
          { kind: "text", text: "Summarise this" },
          { kind: "data", data: { ticket: 42 } },
        ],
      }),
    ).toBe('Summarise this\n\n{"ticket":42}');
    expect(() =>
      readA2aMessageText({
        kind: "message",
        messageId: "m-2",
        role: "user",
        parts: [{ kind: "file", file: { uri: "https://x.test/a.pdf" } }],
      }),
    ).toThrow(expect.objectContaining({ code: A2A_ERRORS.contentTypeNotSupported }));
    expect(() =>
      readA2aMessageText({
        kind: "message",
        messageId: "m-3",
        role: "agent",
        parts: [{ kind: "text", text: "hi" }],
      }),
    ).toThrow("Send messages with the user role");
  });

  it("reports approvals as input-required and refuses another teammate's context", async () => {
    runs.start.mockResolvedValue(
      response({ status: "awaiting_approval", waiting_on: "approval", output: [] }),
    );

    await expect(send({})).resolves.toMatchObject({
      result: {
        status: {
          state: "input-required",
          message: { role: "agent", taskId: "response-1" },
        },
      },
    });
    await expect(send({ contextId: "conversation-9" })).resolves.toMatchObject({
      error: { code: -32602 },
    });
  });
});
