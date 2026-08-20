import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  resolveStoredMessagingProvider: vi.fn(),
  handleCreateChatCompletions: vi.fn(),
  conversationGetInstance: vi.fn(),
  conversationGet: vi.fn(),
  conversationArchiveMessages: vi.fn(),
  providerSend: vi.fn(),
}));

vi.mock("~/lib/conversationManager", () => ({
  ConversationManager: {
    getInstance: mocks.conversationGetInstance,
  },
}));

vi.mock("~/lib/providers/capabilities/messaging/delivery", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("~/lib/providers/capabilities/messaging/delivery")>();

  return {
    ...original,
    resolveStoredMessagingProvider: mocks.resolveStoredMessagingProvider,
  };
});

vi.mock("~/services/completions/createChatCompletions", () => ({
  handleCreateChatCompletions: mocks.handleCreateChatCompletions,
}));

import { AssistantError, ErrorType } from "~/utils/errors";

import { handleInboundChannelMessage, type InboundChannelTaskData } from "../inbound";

const env = { DB: {}, API_BASE_URL: "https://api.polychat.test" } as any;
const user = { id: 42, email: "user@example.com", plan_id: "pro" } as any;

function createContext(providerSettings: Record<string, unknown>[] = []) {
  return {
    env,
    database: {},
    repositories: {
      userSettings: {
        getProviderApiKeyForSettings: vi.fn(async () => "encrypted-config"),
        getUserProviderSettings: vi.fn(async () => providerSettings),
      },
    },
    requestCache: new Map(),
  } as any;
}

function createTaskData(overrides: Partial<InboundChannelTaskData> = {}): InboundChannelTaskData {
  return {
    channel: "sms",
    providerId: "twilio-sms",
    providerSettingsId: "provider-row-1",
    message: {
      messageId: "SM123",
      from: "+15551234567",
      to: "+15557654321",
      body: "what is the weather",
    },
    ...overrides,
  };
}

describe("inbound channel messages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resolveStoredMessagingProvider.mockReturnValue({
      provider: { send: mocks.providerSend },
      allowedSenders: ["+15551234567"],
    });
    mocks.handleCreateChatCompletions.mockResolvedValue({
      choices: [{ message: { content: "chat reply" } }],
    });
    mocks.conversationGet.mockResolvedValue([]);
    mocks.conversationArchiveMessages.mockResolvedValue(undefined);
    mocks.conversationGetInstance.mockReturnValue({
      get: mocks.conversationGet,
      archiveMessages: mocks.conversationArchiveMessages,
    });
  });

  it("runs one agent turn with the channel profile and replies to the sender", async () => {
    const result = await handleInboundChannelMessage({
      env,
      context: createContext(),
      user,
      data: createTaskData(),
    });

    expect(result).toEqual({
      status: "delivered",
      conversationId: expect.stringMatching(/^sms_[0-9a-f]{40}$/),
      body: "chat reply",
    });
    expect(mocks.handleCreateChatCompletions).toHaveBeenCalledWith(
      expect.objectContaining({
        request: expect.objectContaining({
          mode: "agent",
          stream: false,
          max_steps: 3,
          enabled_tools: ["trigger_recipe", "get_task_status", "get_weather"],
          approved_tools: ["trigger_recipe", "get_task_status", "get_weather"],
          options: {
            channel: {
              id: "sms",
              from: "+15551234567",
              to: "+15557654321",
            },
          },
        }),
      }),
    );
    expect(mocks.providerSend).toHaveBeenCalledWith({
      to: "+15551234567",
      body: "chat reply",
    });
  });

  it("surfaces a busy conversation so the queue redelivers instead of interleaving", async () => {
    mocks.handleCreateChatCompletions.mockRejectedValueOnce(
      new AssistantError(
        "This conversation is already working on something.",
        ErrorType.CONFLICT_ERROR,
      ),
    );

    await expect(
      handleInboundChannelMessage({
        env,
        context: createContext(),
        user,
        data: createTaskData(),
      }),
    ).rejects.toMatchObject({ type: ErrorType.CONFLICT_ERROR });

    expect(mocks.providerSend).not.toHaveBeenCalled();
  });

  it("does not run a turn when the sender is no longer allowed", async () => {
    mocks.resolveStoredMessagingProvider.mockReturnValue({
      provider: { send: mocks.providerSend },
      allowedSenders: ["+15559999999"],
    });

    const result = await handleInboundChannelMessage({
      env,
      context: createContext(),
      user,
      data: createTaskData(),
    });

    expect(result).toEqual({ status: "unauthorised_sender" });
    expect(mocks.handleCreateChatCompletions).not.toHaveBeenCalled();
    expect(mocks.providerSend).not.toHaveBeenCalled();
  });

  it("separates conversations by inbound destination identity", async () => {
    await handleInboundChannelMessage({
      env,
      context: createContext(),
      user,
      data: createTaskData(),
    });
    await handleInboundChannelMessage({
      env,
      context: createContext(),
      user,
      data: createTaskData({
        message: {
          messageId: "SM124",
          from: "+15551234567",
          to: "+15550000000",
          body: "what is the weather",
        },
      }),
    });

    const [first] = mocks.handleCreateChatCompletions.mock.calls[0];
    const [second] = mocks.handleCreateChatCompletions.mock.calls[1];

    expect(second.request.completion_id).not.toBe(first.request.completion_id);
  });

  it("bounds stored history to the channel window before running the turn", async () => {
    mocks.conversationGet.mockResolvedValue(
      Array.from({ length: 12 }, (_, index) => ({
        id: `message-${index}`,
        role: index % 2 === 0 ? "user" : "assistant",
        content: `message ${index}`,
      })),
    );

    await handleInboundChannelMessage({
      env,
      context: createContext(),
      user,
      data: createTaskData(),
    });

    expect(mocks.conversationArchiveMessages).toHaveBeenCalledWith(expect.stringMatching(/^sms_/), [
      "message-0",
      "message-1",
      "message-2",
      "message-3",
      "message-4",
    ]);

    const [call] = mocks.handleCreateChatCompletions.mock.calls[0];

    expect(call.request.messages).toHaveLength(8);
    expect(call.request.messages[0].id).toBe("message-5");
  });

  it("passes inbound media into the turn", async () => {
    await handleInboundChannelMessage({
      env,
      context: createContext(),
      user,
      data: createTaskData({
        message: {
          messageId: "SM125",
          from: "+15551234567",
          to: "+15557654321",
          body: "what is this",
          media: [{ url: "https://api.twilio.com/media/1", mimeType: "image/jpeg" }],
        },
      }),
    });

    const [call] = mocks.handleCreateChatCompletions.mock.calls[0];

    expect(call.request.messages[0].content).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "image_url",
          image_url: expect.objectContaining({ url: "https://api.twilio.com/media/1" }),
        }),
      ]),
    );
  });

  it("sends reply media that the configured provider can deliver", async () => {
    mocks.handleCreateChatCompletions.mockResolvedValue({
      choices: [
        {
          message: {
            content: [
              { type: "text", text: "Nutrition summary attached." },
              {
                type: "image_url",
                image_url: { url: "https://api.polychat.test/assets/nutrition-image" },
              },
            ],
          },
        },
      ],
    });

    await handleInboundChannelMessage({
      env,
      context: createContext([
        {
          id: "provider-row-1",
          provider_id: "twilio-sms",
          type: "messaging",
          enabled: true,
          hasApiKey: true,
        },
      ]),
      user,
      data: createTaskData(),
    });

    expect(mocks.providerSend).toHaveBeenCalledWith({
      to: "+15551234567",
      body: "Nutrition summary attached.",
      mediaUrls: ["https://api.polychat.test/assets/nutrition-image"],
    });
  });

  it("normalises AWS replies to the deliverable S3 media URL", async () => {
    mocks.handleCreateChatCompletions.mockResolvedValue({
      choices: [
        {
          message: {
            content: [
              { type: "text", text: "Nutrition summary attached." },
              {
                type: "image_url",
                image_url: { url: "https://api.polychat.test/assets/nutrition-image" },
              },
            ],
            data: {
              assets: [
                { url: "https://api.polychat.test/assets/nutrition-image" },
                { url: "s3://polychat-mms/generated/nutrition-image.png" },
              ],
            },
          },
        },
      ],
    });

    await handleInboundChannelMessage({
      env,
      context: createContext([
        {
          id: "aws-row",
          provider_id: "aws-sms",
          type: "messaging",
          enabled: true,
          hasApiKey: true,
          configurationValues: { mediaBucket: "polychat-mms-media" },
        },
      ]),
      user,
      data: createTaskData({ providerId: "aws-sms", providerSettingsId: "aws-row" }),
    });

    expect(mocks.providerSend).toHaveBeenCalledWith({
      to: "+15551234567",
      body: "Nutrition summary attached.",
      mediaUrls: ["s3://polychat-mms/generated/nutrition-image.png"],
    });
  });
});
