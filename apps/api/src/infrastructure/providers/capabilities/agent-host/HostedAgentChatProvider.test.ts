import type { AgentHostRunSnapshot } from "@ngriffin_uk/polychat-schemas";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import type { ChatCompletionParameters } from "~/types";

const mocks = vi.hoisted(() => ({
  requireHostedAgentAccess: vi.fn(),
  runHostedAgentTurn: vi.fn(),
  resolveHostedAgentRunModel: vi.fn(async (): Promise<{ model: string; effort?: string }> => ({
    model: "test-model",
  })),
}));

vi.mock("./hostedAgentAccess", () => ({
  requireHostedAgentAccess: mocks.requireHostedAgentAccess,
}));
vi.mock("./hostedAgentTurn", () => ({
  runHostedAgentTurn: mocks.runHostedAgentTurn,
}));
vi.mock("~/modules/models/application/hosted-agent-model", () => ({
  resolveHostedAgentRunModel: mocks.resolveHostedAgentRunModel,
}));

import { HERMES_AGENT_HOST_SPEC } from "./agentHostSpec";
import { HostedAgentChatProvider } from "./HostedAgentChatProvider";

const RUN_ID = `run_${"a".repeat(32)}`;
const serviceContext = {
  getUserSettings: vi.fn(async () => ({ default_model_tier: "medium" })),
} as unknown as ServiceContext;

function params(options?: ChatCompletionParameters["options"]): ChatCompletionParameters {
  return {
    completion_id: "conversation-1",
    context: serviceContext,
    messages: [{ role: "user", content: "Run the requested action" }],
    options,
  } as unknown as ChatCompletionParameters;
}

describe("HostedAgentChatProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireHostedAgentAccess.mockReturnValue({
      context: serviceContext,
      user: { id: 7 },
      client: {},
    });
  });

  it("uses the shared approval tool for a Hermes approval request", async () => {
    const approval: NonNullable<AgentHostRunSnapshot["approval"]> = {
      request_id: "request-1",
      command: "delete the cache",
    };

    mocks.runHostedAgentTurn.mockResolvedValue({ runId: RUN_ID, output: "", approval });

    const response = await new HostedAgentChatProvider().getResponse(params());

    expect(response.tool_calls).toEqual([
      expect.objectContaining({
        id: `${RUN_ID}:request:request-1`,
        function: expect.objectContaining({
          name: "request_approval",
          arguments: JSON.stringify({
            message: "Hermes needs your approval: delete the cache",
            options: ["Approve", "Reject"],
          }),
        }),
      }),
    ]);
  });

  it("reports Hermes token usage so metering can account the run", async () => {
    mocks.runHostedAgentTurn.mockResolvedValue({
      runId: RUN_ID,
      output: "Done",
      usage: { input_tokens: 10, output_tokens: 20, total_tokens: 30 },
      runtime: { provider: "openai", model: "gpt-5" },
      toolsUsed: ["terminal"],
    });

    const response = await new HostedAgentChatProvider().getResponse(params());

    expect(response).toMatchObject({
      usage: { input_tokens: 10, output_tokens: 20, total_tokens: 30 },
      data: {
        agentRunId: RUN_ID,
        agentRuntime: { provider: "openai", model: "gpt-5" },
        agentToolsUsed: ["terminal"],
      },
    });
  });

  it("resolves the run model through shared hosted-agent selection", async () => {
    mocks.runHostedAgentTurn.mockResolvedValue({ runId: RUN_ID, output: "Done" });

    await new HostedAgentChatProvider().getResponse({
      ...params(),
      reasoning_effort: "high",
      metadata: { project_id: "project-1" },
    } as unknown as ChatCompletionParameters);

    expect(mocks.resolveHostedAgentRunModel).toHaveBeenCalledWith(
      expect.objectContaining({
        role: "agent",
        capability: "Hermes",
        projectId: "project-1",
      }),
    );
    expect(mocks.resolveHostedAgentRunModel).not.toHaveBeenCalledWith(
      expect.objectContaining({ explicitModel: expect.anything() }),
    );
    expect(mocks.runHostedAgentTurn).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "test-model",
        modelOptions: { reasoning_effort: "high" },
      }),
    );
  });

  it("omits model options the Hermes gateway would reject", async () => {
    mocks.runHostedAgentTurn.mockResolvedValue({ runId: RUN_ID, output: "Done" });
    mocks.resolveHostedAgentRunModel.mockResolvedValueOnce({
      model: "test-model",
      effort: "default",
    });

    await new HostedAgentChatProvider().getResponse(params());

    expect(mocks.runHostedAgentTurn).toHaveBeenCalledWith(
      expect.objectContaining({ model: "test-model" }),
    );
    expect(mocks.runHostedAgentTurn).not.toHaveBeenCalledWith(
      expect.objectContaining({ modelOptions: expect.anything() }),
    );
  });

  it("resumes the same Hermes run with the user's approval decision", async () => {
    mocks.runHostedAgentTurn.mockResolvedValue({ runId: RUN_ID, output: "Action completed" });

    const response = await new HostedAgentChatProvider().getResponse(
      params({
        toolInteraction: {
          toolName: "request_approval",
          response: {
            interactionId: `${RUN_ID}:request:request-1`,
            resolution: "approved",
          },
        },
      }),
    );

    expect(mocks.runHostedAgentTurn).toHaveBeenCalledWith(
      expect.objectContaining({
        input: undefined,
        resume: { runId: RUN_ID, requestId: "request-1", choice: "once" },
      }),
    );
    expect(response.response).toBe("Action completed");
  });

  it("runs a different agent framework through the same machinery via spec", async () => {
    const spec = {
      ...HERMES_AGENT_HOST_SPEC,
      providerName: "other",
      modelName: "other-agent",
      displayName: "Other",
      approvalTool: "request_other_approval",
    };

    mocks.runHostedAgentTurn.mockResolvedValue({ runId: RUN_ID, output: "Done" });

    const provider = new HostedAgentChatProvider(spec);

    expect(provider.name).toBe("other");

    const response = await provider.getResponse(params());

    expect(mocks.runHostedAgentTurn).toHaveBeenCalledWith(
      expect.objectContaining({ spec, model: "test-model" }),
    );
    expect(response).toMatchObject({ model: "other-agent", data: { agentRunId: RUN_ID } });
  });
});
