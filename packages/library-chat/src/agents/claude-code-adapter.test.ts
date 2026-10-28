import type { AgentSessionEvent } from "@ngriffin_uk/polychat-schemas";
import { describe, expect, it } from "vitest";

import { createClaudeCodeAdapter } from "./claude-code-adapter.js";

function setup() {
  const events: AgentSessionEvent[] = [];
  const written: Record<string, unknown>[] = [];
  const adapter = createClaudeCodeAdapter({
    sessionId: "session-1",
    emit: (event) => events.push(event),
    now: () => "2026-10-27T22:00:00.000Z",
    transport: {
      send: async (payload) => {
        const message = JSON.parse(payload) as Record<string, unknown>;

        written.push(message);

        if (message.type === "control_request") {
          queueMicrotask(() =>
            adapter.receive(
              JSON.stringify({
                type: "control_response",
                response: {
                  subtype: "success",
                  request_id: message.request_id,
                  response: { models: [{ value: "opus", displayName: "Opus" }] },
                },
              }),
            ),
          );
        }
      },
    },
  });

  return { adapter, events, written };
}

describe("createClaudeCodeAdapter", () => {
  it("initialises and applies the permission mode and model before the first turn", async () => {
    const { adapter, written } = setup();

    await expect(
      adapter.startThread({
        cwd: "/repo",
        permissionMode: "auto_accept_edits",
        model: "opus",
        reasoningEffort: null,
      }),
    ).resolves.toBe("session-1");

    expect(written.map((message) => (message.request as { subtype: string }).subtype)).toEqual([
      "initialize",
      "set_permission_mode",
      "set_model",
    ]);
    expect(written[1]).toMatchObject({ request: { mode: "acceptEdits" } });
  });

  it("streams the main thread's text and reasoning but not a subagent's", () => {
    const { adapter, events } = setup();
    const delta = (type: string, field: string, value: string, parent: string | null = null) =>
      adapter.receive(
        JSON.stringify({
          type: "stream_event",
          parent_tool_use_id: parent,
          event: { type: "content_block_delta", delta: { type, [field]: value } },
        }),
      );

    delta("text_delta", "text", "Hello");
    delta("thinking_delta", "thinking", "Considering");
    delta("text_delta", "text", "from a subagent", "tool-9");

    expect(events).toEqual([
      { type: "message.delta", delta: "Hello" },
      { type: "reasoning.delta", delta: "Considering" },
    ]);
  });

  it("reports a command as running, then completed with its output", () => {
    const { adapter, events } = setup();

    adapter.receive(
      JSON.stringify({
        type: "assistant",
        message: {
          content: [{ type: "tool_use", id: "tool-1", name: "Bash", input: { command: "ls" } }],
        },
      }),
    );
    adapter.receive(
      JSON.stringify({
        type: "user",
        message: {
          content: [{ type: "tool_result", tool_use_id: "tool-1", content: "README.md" }],
        },
      }),
    );

    expect(events).toEqual([
      {
        type: "item.updated",
        item: {
          id: "tool-1",
          status: "running",
          body: { kind: "command", command: "ls", output: "", exitCode: null },
        },
      },
      {
        type: "item.updated",
        item: {
          id: "tool-1",
          status: "completed",
          body: { kind: "command", command: "ls", output: "README.md", exitCode: 0 },
        },
      },
    ]);
  });

  it("asks for approval and answers with the original input or the session rule", async () => {
    const { adapter, events, written } = setup();
    const request = (id: string) =>
      adapter.receive(
        JSON.stringify({
          type: "control_request",
          request_id: id,
          request: {
            subtype: "can_use_tool",
            tool_name: "Bash",
            input: { command: "rm -rf build" },
            permission_suggestions: [{ type: "addRules" }],
            title: "Claude wants to run rm -rf build",
          },
        }),
      );

    request("perm-1");
    expect(events[0]).toMatchObject({
      type: "approval.requested",
      approval: {
        requestId: "perm-1",
        kind: "command_execution",
        command: "rm -rf build",
        title: "Claude wants to run rm -rf build",
        decisions: ["accept", "accept_for_session", "decline", "cancel"],
      },
    });

    await adapter.answerApproval("perm-1", "accept");
    request("perm-2");
    await adapter.answerApproval("perm-2", "accept_for_session");

    expect(written).toEqual([
      {
        type: "control_response",
        response: {
          subtype: "success",
          request_id: "perm-1",
          response: { behavior: "allow", updatedInput: { command: "rm -rf build" } },
        },
      },
      {
        type: "control_response",
        response: {
          subtype: "success",
          request_id: "perm-2",
          response: {
            behavior: "allow",
            updatedInput: { command: "rm -rf build" },
            updatedPermissions: [{ type: "addRules" }],
          },
        },
      },
    ]);
    await expect(adapter.answerApproval("perm-1", "accept")).rejects.toThrow("no longer waiting");
  });

  it("completes a turn with its usage and fails one the CLI reports as an error", () => {
    const { adapter, events } = setup();

    adapter.receive(
      JSON.stringify({
        type: "result",
        subtype: "success",
        usage: { input_tokens: 10, output_tokens: 5, cache_read_input_tokens: 2 },
      }),
    );
    adapter.receive(
      JSON.stringify({
        type: "result",
        subtype: "success",
        is_error: true,
        result: "Credit balance is too low",
      }),
    );

    expect(events).toEqual([
      {
        type: "usage.updated",
        usage: {
          inputTokens: 10,
          cachedInputTokens: 2,
          cacheWriteInputTokens: 0,
          outputTokens: 5,
          reasoningOutputTokens: 0,
        },
      },
      expect.objectContaining({ type: "turn.completed" }),
      { type: "turn.failed", message: "Credit balance is too low" },
    ]);
  });
});
