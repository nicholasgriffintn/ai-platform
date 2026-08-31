import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ServiceContext } from "~/lib/context/serviceContext";
import { handleFunctions } from "~/services/functions";

import {
  disposeMCPClients,
  handleMCPTool,
  MCP_TOOL_CALL_TIMEOUT_MS,
  registerMCPClient,
  type RegisteredMCPClient,
} from "../mcp";

const AGENT_ID = "agent123-4567-8901-2345-678901234567";
const TOOL_CALL_NAME = `mcp_${AGENT_ID.substring(0, 8)}_search`;

const createContext = (): ServiceContext => ({ requestCache: new Map() }) as ServiceContext;

const createRequest = (context: ServiceContext) => ({
  context,
  request: { functionName: TOOL_CALL_NAME },
});

function createClient(
  label: string,
  overrides: Partial<RegisteredMCPClient> = {},
): RegisteredMCPClient & { dispose: ReturnType<typeof vi.fn> } {
  return {
    mcpConnections: { "server-1": {} },
    getAITools: () => ({ search: {} }),
    callTool: vi.fn(async () => ({ content: label })),
    dispose: vi.fn(async () => {}),
    ...overrides,
  } as RegisteredMCPClient & { dispose: ReturnType<typeof vi.fn> };
}

describe("MCP client lifecycle", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("keeps concurrent registrations for the same agent isolated per request", async () => {
    const contextA = createContext();
    const contextB = createContext();
    const clientA = createClient("from-request-a");
    const clientB = createClient("from-request-b");

    await registerMCPClient(contextA, AGENT_ID, clientA);
    await registerMCPClient(contextB, AGENT_ID, clientB);

    const [resultA, resultB] = await Promise.all([
      handleMCPTool("completion-a", {}, createRequest(contextA)),
      handleMCPTool("completion-b", {}, createRequest(contextB)),
    ]);

    expect(resultA.data?.answer).toBe("from-request-a");
    expect(resultB.data?.answer).toBe("from-request-b");
    expect(clientA.callTool).toHaveBeenCalledTimes(1);
    expect(clientB.callTool).toHaveBeenCalledTimes(1);
    expect(clientA.dispose).not.toHaveBeenCalled();
    expect(clientB.dispose).not.toHaveBeenCalled();
  });

  it("uses the authoritative task-stage policy for MCP execution", async () => {
    const context = createContext();
    const client = createClient("task-stage-network");

    await registerMCPClient(context, AGENT_ID, client);

    const result = await handleFunctions({
      completion_id: "task-1",
      app_url: undefined,
      functionName: TOOL_CALL_NAME,
      args: {},
      request: {
        env: { AI: {} } as any,
        context,
        mode: "plan",
        user: { id: 1, plan_id: "pro" } as any,
        request: {
          completion_id: "task-1",
          input: "validate",
          date: "2026-08-31",
          mode: "plan",
          enforce_mode_tool_policy: false,
        },
      },
    });

    expect(result.data?.answer).toBe("task-stage-network");
    expect(client.callTool).toHaveBeenCalledTimes(1);
  });

  it("uses the explicit tool policy mode for saved-agent execution", async () => {
    const context = createContext();
    const client = createClient("saved-agent-network");

    await registerMCPClient(context, AGENT_ID, client);

    const result = await handleFunctions({
      completion_id: "agent-chat-1",
      app_url: undefined,
      functionName: TOOL_CALL_NAME,
      args: {},
      request: {
        env: { AI: {} } as any,
        context,
        mode: "agent",
        user: { id: 1, plan_id: "pro" } as any,
        request: {
          completion_id: "agent-chat-1",
          input: "search",
          date: "2026-08-31",
          mode: "agent",
          tool_policy_mode: "chat",
        },
      },
    });

    expect(result.data?.answer).toBe("saved-agent-network");
    expect(client.callTool).toHaveBeenCalledTimes(1);
  });

  it("refuses to resolve a client registered against another request", async () => {
    const owningContext = createContext();

    await registerMCPClient(owningContext, AGENT_ID, createClient("owned"));

    await expect(handleMCPTool("completion-c", {}, createRequest(createContext()))).rejects.toThrow(
      /MCP client not found/,
    );
  });

  it("disposes the superseded manager when a registration is overwritten", async () => {
    const context = createContext();
    const first = createClient("first");
    const second = createClient("second");

    await registerMCPClient(context, AGENT_ID, first);
    await registerMCPClient(context, AGENT_ID, second);

    expect(first.dispose).toHaveBeenCalledTimes(1);
    expect(second.dispose).not.toHaveBeenCalled();

    const result = await handleMCPTool("completion-d", {}, createRequest(context));

    expect(result.data?.answer).toBe("second");
  });

  it("disposes every registered manager on completion teardown", async () => {
    const context = createContext();
    const client = createClient("teardown");

    await registerMCPClient(context, AGENT_ID, client);
    await disposeMCPClients(context);

    expect(client.dispose).toHaveBeenCalledTimes(1);

    await expect(handleMCPTool("completion-e", {}, createRequest(context))).rejects.toThrow(
      /MCP client not found/,
    );
  });

  it("aborts a stalled tool call instead of hanging the turn", async () => {
    const nativeTimeout = AbortSignal.timeout.bind(AbortSignal);
    const timeoutSpy = vi.spyOn(AbortSignal, "timeout").mockImplementation(() => nativeTimeout(10));

    const context = createContext();
    const stalled = createClient("stalled", {
      callTool: vi.fn<RegisteredMCPClient["callTool"]>(
        (_toolCall, _requestId, options) =>
          new Promise<Record<string, unknown>>((_resolve, reject) => {
            options.signal.addEventListener("abort", () => reject(options.signal.reason));
          }),
      ),
    });

    await registerMCPClient(context, AGENT_ID, stalled);

    await expect(handleMCPTool("completion-f", {}, createRequest(context))).rejects.toThrow(
      /MCP tool execution failed/,
    );
    expect(timeoutSpy).toHaveBeenCalledWith(MCP_TOOL_CALL_TIMEOUT_MS);
  });
});
