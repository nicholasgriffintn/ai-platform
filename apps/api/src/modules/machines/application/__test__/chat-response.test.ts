import { agentModelConfig } from "@ngriffin_uk/polychat-schemas";
import { describe, expect, it, vi } from "vitest";

import { fakeRepositories } from "~/infrastructure/database/__test__/fake-repositories";
import { ConversationRunRepository } from "~/modules/conversations/infrastructure/ConversationRunRepository";
import type { ChatCompletionParameters } from "~/types";

import { executeMachineChatResponse } from "../chat-response";

const callMachineRun = vi.hoisted(() => vi.fn());

vi.mock("../runs", () => ({ callMachineRun }));
vi.mock("~/modules/responses/application/runs/execution-authority", () => ({
  requireActiveExecutionRun: vi.fn(async () => undefined),
}));
vi.mock("@ngriffin_uk/polychat-utility-core", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@ngriffin_uk/polychat-utility-core")>()),
  abortableDelay: vi.fn(async () => undefined),
}));

function snapshot(state: string, text: string) {
  return new Response(JSON.stringify({ id: "6f1c2b3a-4d5e-4f60-8a71-92b3c4d5e6f7", state, text }));
}

async function readStream(stream: ReadableStream<Uint8Array>): Promise<string> {
  return new Response(stream).text();
}

describe("executeMachineChatResponse", () => {
  it("streams only the new text from each machine snapshot", async () => {
    callMachineRun
      .mockResolvedValueOnce(snapshot("running", "Hel"))
      .mockResolvedValueOnce(snapshot("running", "Hel"))
      .mockResolvedValueOnce(snapshot("completed", "Hello"));

    const params = {
      stream: true,
      completion_id: "conversation-1",
      messages: [{ role: "user", content: "Hi" }],
      context: {
        user: { id: 7 },
        executionRunId: undefined,
        repositories: fakeRepositories([[ConversationRunRepository, { getById: vi.fn() }]]),
      },
    } as unknown as ChatCompletionParameters;

    const stream = await executeMachineChatResponse(params, {
      id: "machine/desktop-1/ollama/gemma3:1b",
      matchingModel: "gemma3:1b",
      provider: "ollama",
      machineId: "desktop-1",
    });

    expect(stream).toBeInstanceOf(ReadableStream);
    expect(await readStream(stream as ReadableStream<Uint8Array>)).toBe(
      [
        'data: {"type":"response.output_text.delta","delta":"Hel"}',
        'data: {"type":"response.output_text.delta","delta":"lo"}',
        "data: [DONE]",
        "",
      ].join("\n\n"),
    );
  });

  const agentModel = {
    ...agentModelConfig["agent/claude-code"],
    id: "machine/desktop-1/claude-code/claude-code",
    name: "Claude Code",
    matchingModel: "claude-code",
    provider: "claude-code",
    machineId: "desktop-1",
  };

  function agentParams(options?: Record<string, unknown>) {
    return {
      stream: true,
      completion_id: "conversation-1",
      messages: [{ role: "user", content: "Tidy the README" }],
      permission_mode: "supervised",
      options,
      context: {
        user: { id: 7 },
        executionRunId: undefined,
        repositories: fakeRepositories([[ConversationRunRepository, { getById: vi.fn() }]]),
      },
    } as unknown as ChatCompletionParameters;
  }

  function events(state: string, records: unknown[]) {
    return new Response(
      JSON.stringify({ id: "6f1c2b3a-4d5e-4f60-8a71-92b3c4d5e6f7", state, records }),
    );
  }

  it("starts an agent on the machine and pauses the run on its approval request", async () => {
    callMachineRun.mockReset();
    callMachineRun.mockResolvedValueOnce(snapshot("pending", "")).mockResolvedValueOnce(
      events("running", [
        { seq: 1, event: { type: "text-delta", partId: "message", delta: "Checking" } },
        {
          seq: 2,
          event: {
            type: "approval-requested",
            approvalId: "perm-1",
            toolName: "command_execution",
            description: "Claude wants to run rm README.old",
          },
        },
      ]),
    );

    const stream = await executeMachineChatResponse(agentParams(), agentModel);
    const body = await readStream(stream as ReadableStream<Uint8Array>);

    expect(callMachineRun.mock.calls[0]).toEqual([
      expect.anything(),
      "desktop-1",
      "/create",
      expect.objectContaining({
        kind: "agent",
        driver: "claude-code",
        continuationMode: "auto",
        bindingConversationId: "conversation-1",
        permissionMode: "supervised",
      }),
    ]);
    expect(body).toContain('"content":"Checking"');
    expect(body).toContain('"id":"hx-2-perm-1"');
    expect(body).toContain('"name":"request_approval"');
    expect(body).toContain('"finish_reason":"tool_calls"');
  });

  it("sends the person's answer back to the machine and carries on after it", async () => {
    callMachineRun.mockReset();
    callMachineRun.mockResolvedValueOnce(Response.json({ applied: true })).mockResolvedValueOnce(
      events("completed", [
        { seq: 3, event: { type: "text-delta", partId: "message", delta: "Done" } },
        { seq: 4, event: { type: "operation-settled", operationId: "run-1", status: "done" } },
      ]),
    );

    const stream = await executeMachineChatResponse(
      agentParams({
        toolInteraction: {
          toolName: "request_approval",
          response: { interactionId: "hx-2-perm-1", resolution: "approved" },
        },
      }),
      agentModel,
    );
    const body = await readStream(stream as ReadableStream<Uint8Array>);

    expect(callMachineRun.mock.calls[0]).toEqual([
      expect.anything(),
      "desktop-1",
      "/decide",
      { conversationId: "conversation-1", approvalId: "perm-1", approved: true },
    ]);
    expect(callMachineRun.mock.calls[1]?.[2]).toBe("/events/conversation-1/2");
    expect(body).toContain('"content":"Done"');
    expect(body).toContain('"finish_reason":"stop"');
  });
});
