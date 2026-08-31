import { beforeEach, describe, expect, it, vi } from "vitest";

import type { OutputRecord } from "~/repositories/OutputRepository";
import type { IEnv, IUser } from "~/types";

const mocks = vi.hoisted(() => ({
  getAsyncInvocationStatus: vi.fn(),
  getOutput: vi.fn(),
  getUserById: vi.fn(),
  resolveExecutableModelForRequest: vi.fn(),
  updateOutput: vi.fn(),
}));

vi.mock("~/lib/chat/policy/model-access", () => ({
  resolveExecutableModelForRequest: mocks.resolveExecutableModelForRequest,
}));

vi.mock("~/lib/providers/capabilities/chat", () => ({
  getChatProvider: vi.fn(() => ({
    getAsyncInvocationStatus: mocks.getAsyncInvocationStatus,
  })),
}));

vi.mock("~/repositories/OutputRepository", () => ({
  OutputRepository: class {
    getOutput = mocks.getOutput;
    updateOutput = mocks.updateOutput;
  },
}));

vi.mock("~/repositories/UserRepository", () => ({
  UserRepository: class {
    getUserById = mocks.getUserById;
  },
}));

import type { TaskMessage } from "../TaskService";
import { ReplicatePollingHandler } from "./ReplicatePollingHandler";

const env: IEnv = Object.create(null);
const user = {
  id: 42,
  name: null,
  avatar_url: null,
  email: "byok@example.com",
  github_username: null,
  company: null,
  site: null,
  location: null,
  bio: null,
  twitter_username: null,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
  setup_at: null,
  terms_accepted_at: null,
  plan_id: "free",
} satisfies IUser;

function outputRecord(): OutputRecord {
  return {
    id: "prediction-1",
    created_by_user_id: user.id,
    project_id: null,
    conversation_id: null,
    parent_output_id: null,
    capability_id: "image-generation",
    group_id: null,
    kind: "image",
    title: "Prediction",
    status: "pending",
    sensitivity: "personal",
    content: JSON.stringify({
      status: "processing",
      predictionData: {
        data: {
          asyncInvocation: {
            provider: "replicate",
            id: "provider-prediction-1",
            type: "replicate.prediction",
            context: { version: "owner/flux:version" },
          },
        },
      },
    }),
    storage_key: null,
    mime_type: null,
    filename: null,
    byte_size: null,
    revision: 1,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: null,
  };
}

describe("ReplicatePollingHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getOutput.mockResolvedValue(outputRecord());
    mocks.getUserById.mockResolvedValue(user);
    mocks.resolveExecutableModelForRequest.mockResolvedValue({
      id: "flux-dev",
      config: { provider: "replicate", matchingModel: "owner/flux:version" },
      credentialAuthority: "byok",
    });
    mocks.getAsyncInvocationStatus.mockResolvedValue({
      status: "completed",
      result: { response: "https://example.com/image.png" },
      raw: { status: "succeeded" },
    });
  });

  it("re-resolves and preserves BYOK authority for queued polling", async () => {
    const message = {
      taskId: "task-1",
      task_type: "replicate_polling",
      task_data: {
        predictionId: "prediction-1",
        userId: user.id,
        modelId: "flux-dev",
        startedAt: "2026-01-01T00:00:00.000Z",
      },
      priority: 5,
    } satisfies TaskMessage;

    const result = await new ReplicatePollingHandler().handle(message, env);

    expect(result.status).toBe("success");
    expect(mocks.resolveExecutableModelForRequest).toHaveBeenCalledWith({
      env,
      user,
      model: "flux-dev",
      provider: "replicate",
    });
    expect(mocks.getAsyncInvocationStatus).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ credentialAuthority: "byok" }),
      user.id,
    );
  });
});
