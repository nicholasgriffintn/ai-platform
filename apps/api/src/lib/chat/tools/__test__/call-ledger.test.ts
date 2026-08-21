import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  handleFunctions: vi.fn(),
  resolveToolRepeatLimit: vi.fn(),
}));

vi.mock("~/services/functions", () => ({
  handleFunctions: mocks.handleFunctions,
  resolveToolRepeatLimit: mocks.resolveToolRepeatLimit,
}));

import type { ConversationManager } from "~/lib/conversationManager";
import type { IRequest } from "~/types";

import { createToolCallLedger } from "../call-ledger";
import { handleToolCalls } from "../execution";

function toolCall(name: string, args: Record<string, unknown>, id: string) {
  return { id, type: "function", function: { name, arguments: JSON.stringify(args) } };
}

function createConversationManager() {
  return { add: vi.fn(), addBatch: vi.fn() } as unknown as ConversationManager;
}

function createRequest() {
  return {
    env: { AI: {} },
    mode: "chat",
    request: { model: "test-model", platform: "api" },
  } as unknown as IRequest;
}

async function run(
  toolCalls: unknown[],
  callLedger: ReturnType<typeof createToolCallLedger>,
): Promise<any[]> {
  return handleToolCalls(
    "completion-1",
    { response: "", tool_calls: toolCalls },
    createConversationManager(),
    createRequest(),
    { persistResults: "none", callLedger },
  );
}

describe("repeated tool call guard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.handleFunctions.mockResolvedValue({ status: "success", content: "result" });
    mocks.resolveToolRepeatLimit.mockReturnValue(undefined);
  });

  it("refuses an identical call once the tool's own limit is spent", async () => {
    mocks.resolveToolRepeatLimit.mockReturnValue(1);
    const ledger = createToolCallLedger();

    const [first] = await run([toolCall("load_skill", { skill: "artifacts" }, "call-1")], ledger);
    const [second] = await run([toolCall("load_skill", { skill: "artifacts" }, "call-2")], ledger);

    expect(mocks.handleFunctions).toHaveBeenCalledTimes(1);
    expect(first.status).toBe("success");
    expect(second.status).toBe("error");
    expect(second.data.errorCode).toBe("REPEATED_TOOL_CALL");
    expect(second.tool_call_id).toBe("call-2");
  });

  it("still answers the model when it repeats a call, so the provider keeps a result per call", async () => {
    mocks.resolveToolRepeatLimit.mockReturnValue(1);
    const ledger = createToolCallLedger();

    await run([toolCall("load_skill", { skill: "artifacts" }, "call-1")], ledger);
    const results = await run(
      [
        toolCall("load_skill", { skill: "artifacts" }, "call-2"),
        toolCall("load_skill", { skill: "artifacts" }, "call-3"),
      ],
      ledger,
    );

    expect(results).toHaveLength(2);
    expect(results.map((result) => result.tool_call_id)).toEqual(["call-2", "call-3"]);
  });

  it("treats the same arguments in a different key order as the same call", async () => {
    mocks.resolveToolRepeatLimit.mockReturnValue(1);
    const ledger = createToolCallLedger();

    await run(
      [toolCall("load_skill", { skill: "artifacts", resource: "references/types.md" }, "call-1")],
      ledger,
    );
    const [second] = await run(
      [toolCall("load_skill", { resource: "references/types.md", skill: "artifacts" }, "call-2")],
      ledger,
    );

    expect(second.status).toBe("error");
    expect(mocks.handleFunctions).toHaveBeenCalledTimes(1);
  });

  it("leaves a different argument set free to run", async () => {
    mocks.resolveToolRepeatLimit.mockReturnValue(1);
    const ledger = createToolCallLedger();

    await run([toolCall("load_skill", { skill: "artifacts" }, "call-1")], ledger);
    const [second] = await run(
      [toolCall("load_skill", { skill: "artifacts", resource: "references/types.md" }, "call-2")],
      ledger,
    );

    expect(second.status).toBe("success");
    expect(mocks.handleFunctions).toHaveBeenCalledTimes(2);
  });

  it("allows a handful of identical calls for tools that declare no limit", async () => {
    const ledger = createToolCallLedger();
    const statuses: string[] = [];

    for (let attempt = 1; attempt <= 4; attempt += 1) {
      const [result] = await run(
        [toolCall("get_task_status", { taskId: "task-1" }, `call-${attempt}`)],
        ledger,
      );

      statuses.push(result.status);
    }

    expect(statuses).toEqual(["success", "success", "success", "error"]);
  });
});
