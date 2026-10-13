import type { Message } from "@ngriffin_uk/polychat-library-chat/conversation-types";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "../http.js";
import { buildCreateResponseBody, ResponsesService } from "./responses-service.js";

function createSseResponse(events: string[]): Response {
  const encoder = new TextEncoder();

  return new Response(
    new ReadableStream({
      start(controller) {
        for (const event of events) {
          controller.enqueue(encoder.encode(event));
        }

        controller.close();
      },
    }),
    { headers: { "Content-Type": "text/event-stream" } },
  );
}

function sse(payload: unknown): string {
  return `data: ${typeof payload === "string" ? payload : JSON.stringify(payload)}\n\n`;
}

const response = {
  object: "response",
  id: "resp-1",
  conversation_id: "conversation-1",
  status: "in_progress",
  waiting_on: null,
  attempt: 1,
  trigger: "user",
  initiator_user_id: 7,
  project_id: null,
  project_task_id: null,
  created_at: "2026-09-05T12:00:00.000Z",
  updated_at: "2026-09-05T12:00:01.000Z",
  started_at: "2026-09-05T12:00:01.000Z",
  completed_at: null,
  terminal_reason: null,
  last_item_id: null,
};

const baseParams = {
  chatSettings: {},
  completionId: "conversation-1",
  messages: [{ role: "user", content: "Hello" } as Message],
  mode: "chat" as const,
  onProgress: () => {},
  onStateChange: () => {},
  signal: new AbortController().signal,
};

describe("buildCreateResponseBody", () => {
  it("names the conversation, items and idempotency key", () => {
    const body = buildCreateResponseBody({
      ...baseParams,
      model: "gpt",
      requestOptions: { command_id: "command-1", metadata: { project_id: "project-1" } },
    });

    expect(body.conversation).toEqual({ id: "conversation-1", project_id: "project-1" });
    expect(body.input).toEqual([
      expect.objectContaining({
        type: "message",
        role: "user",
        content: [{ type: "text", text: "Hello" }],
      }),
    ]);
    expect(body.idempotency_key).toBe("command-1");
    expect(body.model).toBe("gpt");
    expect(body.client).toEqual({ platform: "web" });
  });

  it("omits tools when tools are not allowed", () => {
    const body = buildCreateResponseBody({
      ...baseParams,
      allowTools: false,
      selectedTools: ["web_search"],
      toolSelectionMode: "managed",
      requestOptions: { approved_tools: ["store_memory"] },
    });

    expect(body.tools).toBeUndefined();
  });

  it("sends approved, selected and hosted tools as one typed list", () => {
    const body = buildCreateResponseBody({
      ...baseParams,
      selectedTools: ["web_fetch", "web_search"],
      toolSelectionMode: "managed",
      chatSettings: { tool_options: { web_search: { depth: "deep" } } },
      requestOptions: { approved_tools: ["store_memory"] },
    });

    expect(body.tools).toEqual([
      { type: "managed" },
      { type: "builtin", id: "web_fetch" },
      { type: "web_search", settings: { depth: "deep" } },
      { type: "builtin", id: "store_memory", policy: "approved" },
    ]);
  });

  it("turns an approval reply and a tool interaction into input items", () => {
    const body = buildCreateResponseBody({
      ...baseParams,
      requestOptions: {
        connector_approval_id: "coa_1",
        run_id: "resp-1",
        options: { toolInteraction: { toolName: "ask_user", response: { answer: "yes" } } },
      },
    });

    expect(body.response_id).toBe("resp-1");
    expect(body.input).toEqual([
      expect.objectContaining({ type: "message" }),
      { type: "interaction_response", tool_name: "ask_user", response: { answer: "yes" } },
      { type: "approval_response", approval_id: "coa_1" },
    ]);
  });

  it("maps the sandbox feature options onto a sandbox environment", () => {
    const body = buildCreateResponseBody({
      ...baseParams,
      computeSite: "hosted",
      requestOptions: { options: { sandbox: { enabled: true, repo: "owner/repo", maxSteps: 4 } } },
    });

    expect(body.environment).toEqual({ type: "sandbox", repo: "owner/repo", maxSteps: 4 });
    expect(body.budget).toEqual({ steps: 4 });
  });
});

describe("ResponsesService streaming", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("rebuilds the assistant message and surfaces the response lifecycle", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        createSseResponse([
          sse({ type: "response.created", sequence_number: 0, response }),
          sse({
            type: "response.output_item.added",
            sequence_number: 1,
            output_index: 0,
            item: { type: "message", role: "assistant", id: "msg-1", content: [] },
          }),
          sse({
            type: "response.output_text.delta",
            sequence_number: 2,
            item_id: "msg-1",
            output_index: 0,
            delta: "Hel",
          }),
          sse({
            type: "response.output_text.delta",
            sequence_number: 3,
            item_id: "msg-1",
            output_index: 0,
            delta: "lo",
          }),
          sse({ type: "response.usage_limits", sequence_number: 4, usage_limits: { left: 1 } }),
          sse({
            type: "response.output_item.done",
            sequence_number: 5,
            output_index: 0,
            item: {
              type: "message",
              role: "assistant",
              id: "msg-1",
              content: [{ type: "text", text: "Hello" }],
              metadata: { model: "gpt", log_id: "log-1" },
            },
            finish_reason: "stop",
          }),
          sse({
            type: "response.completed",
            sequence_number: 6,
            response: { ...response, status: "completed" },
          }),
          sse("[DONE]"),
        ]),
      ),
    );

    const states: Array<[string, unknown]> = [];
    const progress: string[] = [];
    const service = new ResponsesService(async () => ({}));
    const message = await service.create({
      ...baseParams,
      model: "gpt",
      onProgress: (text) => progress.push(text),
      onStateChange: (state, data) => states.push([state, data]),
    });

    expect(progress).toEqual(["", "Hel", "Hello", "Hello"]);
    expect(message).toMatchObject({
      id: "msg-1",
      role: "assistant",
      content: "Hello",
      model: "gpt",
    });
    expect(states.map(([state]) => state)).toEqual(["response", "usage_limits", "response"]);
    expect(states[2][1]).toMatchObject({ id: "resp-1", status: "completed" });
  });

  it("throws streamed errors as API errors without inventing assistant text", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        createSseResponse([
          sse({
            type: "response.error",
            sequence_number: 0,
            error: { message: "Quota exhausted" },
            code: "insufficient_quota",
          }),
        ]),
      ),
    );

    const service = new ResponsesService(async () => ({}));

    await expect(service.create(baseParams)).rejects.toMatchObject({
      message: "Quota exhausted",
      status: 429,
    });
    await expect(service.create(baseParams)).rejects.toBeInstanceOf(ApiError);
  });

  it("reads a non-streamed response as the assistant message", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          data: {
            ...response,
            status: "completed",
            output: [
              {
                type: "message",
                role: "assistant",
                id: "msg-1",
                content: [{ type: "text", text: "Done" }],
                metadata: { model: "gpt" },
              },
            ],
          },
        }),
      ),
    );

    const states: string[] = [];
    const service = new ResponsesService(async () => ({}));
    const message = await service.create({
      ...baseParams,
      streamingEnabled: false,
      onStateChange: (state) => states.push(state),
    });

    expect(message).toMatchObject({ id: "msg-1", content: "Done", model: "gpt" });
    expect(states).toEqual(["response"]);
  });
});
