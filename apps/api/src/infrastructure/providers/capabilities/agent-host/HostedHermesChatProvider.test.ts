import type { AgentHostRunSnapshot } from "@ngriffin_uk/polychat-schemas";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import type { ChatCompletionParameters } from "~/types";

const mocks = vi.hoisted(() => ({
  requireHostedHermesAccess: vi.fn(),
  runHostedHermesTurn: vi.fn(),
}));

vi.mock("./hostedHermesAccess", () => ({
  requireHostedHermesAccess: mocks.requireHostedHermesAccess,
}));
vi.mock("./hostedHermesTurn", () => ({
  runHostedHermesTurn: mocks.runHostedHermesTurn,
}));

import { HostedHermesChatProvider } from "./HostedHermesChatProvider";

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

describe("HostedHermesChatProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireHostedHermesAccess.mockReturnValue({
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

    mocks.runHostedHermesTurn.mockResolvedValue({ runId: RUN_ID, output: "", approval });

    const response = await new HostedHermesChatProvider().getResponse(params());

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

  it("resumes the same Hermes run with the user's approval decision", async () => {
    mocks.runHostedHermesTurn.mockResolvedValue({ runId: RUN_ID, output: "Action completed" });

    const response = await new HostedHermesChatProvider().getResponse(
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

    expect(mocks.runHostedHermesTurn).toHaveBeenCalledWith(
      expect.objectContaining({
        input: undefined,
        resume: { runId: RUN_ID, requestId: "request-1", choice: "once" },
      }),
    );
    expect(response.response).toBe("Action completed");
  });
});
