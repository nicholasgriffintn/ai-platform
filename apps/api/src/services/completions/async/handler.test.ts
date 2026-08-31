import { beforeEach, describe, expect, it, vi } from "vitest";

import type { IEnv, IUser, Message } from "~/types";

const mocks = vi.hoisted(() => ({
  getAsyncInvocationStatus: vi.fn(),
  resolveExecutableModelForRequest: vi.fn(),
}));

vi.mock("~/lib/chat/policy/model-access", () => ({
  resolveExecutableModelForRequest: mocks.resolveExecutableModelForRequest,
}));

vi.mock("~/lib/providers/capabilities/chat", () => ({
  getChatProvider: vi.fn(() => ({
    getAsyncInvocationStatus: mocks.getAsyncInvocationStatus,
  })),
  listChatProviders: vi.fn(() => ["replicate"]),
}));

import { handleAsyncInvocation } from "./handler";

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

describe("handleAsyncInvocation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resolveExecutableModelForRequest.mockResolvedValue({
      id: "flux-dev",
      config: { provider: "replicate", matchingModel: "owner/flux:version" },
      credentialAuthority: "byok",
    });
    mocks.getAsyncInvocationStatus.mockResolvedValue({
      status: "in_progress",
      raw: { status: "processing" },
    });
  });

  it("re-resolves and preserves BYOK authority when refreshing a conversation", async () => {
    const message = {
      role: "assistant",
      model: "flux-dev",
      content: "Generation in progress",
      data: {},
    } satisfies Message;
    const update = vi.fn();

    await handleAsyncInvocation(
      { provider: "replicate", id: "prediction-1", type: "replicate.prediction" },
      message,
      {
        conversationManager: { update },
        conversationId: "conversation-1",
        env,
        user,
      },
    );

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
