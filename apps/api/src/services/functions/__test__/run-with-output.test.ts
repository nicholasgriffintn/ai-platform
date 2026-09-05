import { beforeEach, describe, expect, it, vi } from "vitest";

import type { IRequest } from "~/types";

import { runFunctionWithOutput } from "../run-with-output";

vi.mock("~/lib/conversationManager", () => ({
  ConversationManager: {
    getInstance: vi.fn(),
  },
}));

vi.mock("~/services/functions", () => ({
  handleFunctions: vi.fn(),
}));

const outputRepository = {
  createOutput: vi.fn(),
  updateOutput: vi.fn(),
};

const anonymousUser = {
  id: "anon-123",
  ip_address: "127.0.0.1",
  created_at: "2026-06-04T00:00:00.000Z",
  updated_at: "2026-06-04T00:00:00.000Z",
};

function createRequest(overrides: Partial<IRequest> = {}): IRequest {
  const env = {
    DB: {},
    CACHE: null,
  } as any;

  return {
    app_url: "https://app.example.com",
    context: {
      database: {},
      env,
      repositories: {
        outputs: outputRepository,
      },
      requestCache: new Map(),
    } as any,
    env,
    request: {
      completion_id: "completion-123",
    } as any,
    user: {
      id: 42,
    } as any,
    ...overrides,
  };
}

describe("runFunctionWithOutput", () => {
  beforeEach(async () => {
    vi.clearAllMocks();

    outputRepository.createOutput.mockReset();
    outputRepository.updateOutput.mockReset();

    const { ConversationManager } = await import("~/lib/conversationManager");

    vi.mocked(ConversationManager.getInstance).mockReturnValue({} as any);
  });

  it("persists async function results and adds the stored response id to async context", async () => {
    const { handleFunctions } = await import("~/services/functions");
    const functionName = "run_code_review";
    const formData = { topic: "Agents" };
    const functionResult = {
      success: true,
      data: {
        asyncInvocation: {
          id: "async-123",
          context: {
            source: "queue",
          },
        },
      },
    };

    vi.mocked(handleFunctions).mockResolvedValue(functionResult);

    const createOutputSpy = outputRepository.createOutput.mockResolvedValue({
      id: "response-123",
      revision: 1,
    } as any);
    const updateOutputSpy = outputRepository.updateOutput.mockResolvedValue(undefined);

    const result = await runFunctionWithOutput(functionName, formData, createRequest());

    expect(createOutputSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        createdByUserId: 42,
        projectId: undefined,
        capabilityId: functionName,
        groupId: "async-123",
        kind: "dynamic_app_response",
        title: `App output: ${functionName}`,
        content: {
          formData,
          result: functionResult,
        },
        provenance: expect.objectContaining({
          origin: "generated",
          completeness: "partial",
          run: null,
          model: null,
        }),
      }),
    );
    expect(updateOutputSpy).toHaveBeenCalledWith(
      "response-123",
      expect.objectContaining({
        content: expect.objectContaining({
          formData,
          result: expect.objectContaining({
            data: expect.objectContaining({
              asyncInvocation: expect.objectContaining({
                id: "async-123",
                context: {
                  source: "queue",
                  responseId: "response-123",
                },
              }),
            }),
          }),
        }),
      }),
    );
    expect(result).toMatchObject({
      success: true,
      output_id: "response-123",
      data: {
        input: formData,
        result: {
          data: {
            asyncInvocation: {
              id: "async-123",
              context: {
                source: "queue",
                responseId: "response-123",
              },
            },
          },
        },
      },
    });
  });

  it("returns async execution results without persisting them for anonymous requests", async () => {
    const { handleFunctions } = await import("~/services/functions");
    const functionName = "run_code_review";
    const functionResult = {
      success: true,
      data: {
        asyncInvocation: {
          id: "async-456",
          context: {
            source: "queue",
          },
        },
      },
    };

    vi.mocked(handleFunctions).mockResolvedValue(functionResult);

    const createResponseSpy = outputRepository.createOutput;
    const updateResponseDataSpy = outputRepository.updateOutput;

    const result = await runFunctionWithOutput(
      functionName,
      { topic: "Anonymous" },
      createRequest({ anonymousUser, user: undefined }),
    );

    expect(createResponseSpy).not.toHaveBeenCalled();
    expect(updateResponseDataSpy).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      success: true,
      data: {
        result: functionResult,
      },
    });
    expect(result.response_id).toBeUndefined();

    const { ConversationManager } = await import("~/lib/conversationManager");

    expect(ConversationManager.getInstance).toHaveBeenCalledWith(
      expect.objectContaining({
        anonymousUser,
        store: false,
        user: undefined,
      }),
    );
  });
});
