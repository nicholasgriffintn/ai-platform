import {
  A2A_ERRORS,
  a2aAgentCardSchema,
  teammateSummarySchema,
  type PlatformResponse,
} from "@ngriffin_uk/polychat-schemas";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";

import { buildTeammateAgentCard } from "../agent-card";
import { handleA2aRequest, readA2aMessageText } from "../server";
import { createA2aStreamProjection } from "../tasks";

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

const teammate = teammateSummarySchema.parse({
  id: "teammate-1",
  name: "Ada",
  kind: "colleague",
  description: "Research lead",
  avatarUrl: null,
  characterId: null,
  model: null,
  modelAvailable: true,
  mode: null,
  ownerScopeType: "user",
  skillIds: [],
  toolIds: [],
  unavailableSkillIds: [],
  unavailableToolIds: [],
  scorecard: { good: 0, bad: 0 },
});

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

  it("publishes a valid agent card that points at the teammate's endpoint", () => {
    const card = buildTeammateAgentCard(teammate, "https://api.polychat.app");

    expect(a2aAgentCardSchema.parse(card)).toMatchObject({
      name: "Ada",
      url: "https://api.polychat.app/a2a/teammates/teammate-1/rpc",
      capabilities: { streaming: true, pushNotifications: false },
      security: [{ polychatApiKey: [] }],
    });
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

  it("starts a Response for message/send and answers with it as a task", async () => {
    runs.start.mockResolvedValue(response());

    await expect(send({ contextId: "conversation-1" })).resolves.toMatchObject({
      result: {
        kind: "task",
        id: "response-1",
        contextId: "conversation-1",
        status: { state: "completed" },
        artifacts: [
          { artifactId: "item-1", parts: [{ kind: "text", text: "Here is the summary" }] },
        ],
      },
    });
    expect(runs.start).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        teammateId: "teammate-1",
        text: "Hello",
        idempotencyKey: "a2a:teammate-1:m-1",
      }),
    );
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

  it("follows up, reads and cancels only tasks in the teammate's conversation", async () => {
    runs.read.mockResolvedValueOnce(null);

    await expect(rpc("tasks/get", { id: "response-x" })).resolves.toMatchObject({
      error: { code: A2A_ERRORS.taskNotFound },
    });

    runs.read.mockResolvedValue(response({ status: "in_progress" }));
    runs.cancel.mockResolvedValue(response({ status: "cancelling" }));

    await expect(send({ taskId: "response-1" })).resolves.toMatchObject({
      result: { id: "response-1", status: { state: "working" } },
    });
    expect(runs.followUp).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ id: "response-1" }),
      "Hello",
      "a2a",
    );
    await expect(rpc("tasks/cancel", { id: "response-1" })).resolves.toMatchObject({
      result: { status: { state: "working" } },
    });

    runs.read.mockResolvedValue(response());

    await expect(rpc("tasks/cancel", { id: "response-1" })).resolves.toMatchObject({
      error: { code: A2A_ERRORS.taskNotCancelable },
    });
  });

  it("refuses push notification configuration with the protocol's error", async () => {
    await expect(rpc("tasks/pushNotificationConfig/set", {})).resolves.toMatchObject({
      error: { code: A2A_ERRORS.pushNotificationNotSupported },
    });
  });
});

describe("A2A stream projection", () => {
  it("turns the Response event envelope into a task, artifact chunks and a final status", () => {
    const projection = createA2aStreamProjection();
    const running = response({ status: "in_progress", output: [] });
    const envelope = { sequence_number: 0, response_id: "response-1" };

    expect(
      projection.project({ type: "response.created", response: running, ...envelope }),
    ).toMatchObject([{ kind: "task", id: "response-1", status: { state: "working" } }]);

    const deltas = ["Here ", "it is"].flatMap((delta, index) =>
      projection.project({
        type: "response.output_text.delta",
        item_id: "item-1",
        output_index: 0,
        delta,
        ...envelope,
        sequence_number: index + 1,
      }),
    );

    expect(deltas).toMatchObject([
      { kind: "artifact-update", append: false, artifact: { parts: [{ text: "Here " }] } },
      { kind: "artifact-update", append: true, artifact: { parts: [{ text: "it is" }] } },
    ]);
    expect(
      projection.project({ type: "response.completed", response: response(), ...envelope }),
    ).toMatchObject([{ kind: "status-update", final: true, status: { state: "completed" } }]);
    expect(projection.finished).toBe(true);
    expect(
      projection.project({ type: "response.completed", response: response(), ...envelope }),
    ).toEqual([]);
  });
});
