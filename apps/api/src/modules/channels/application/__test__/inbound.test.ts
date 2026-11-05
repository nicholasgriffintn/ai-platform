import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  resolveStoredMessagingProvider: vi.fn(),
  startResponse: vi.fn(),
  conversationGetInstance: vi.fn(),
  conversationGet: vi.fn(),
  conversationArchiveMessages: vi.fn(),
  providerSend: vi.fn(),
  disclosureSent: vi.fn(),
  recordSent: vi.fn(),
  judgeChannelEvent: vi.fn(),
  adapterSendReply: vi.fn(),
  eligibleSender: vi.fn(),
  requireChannelSenderMapping: vi.fn(),
}));

vi.mock("../channel-event-judgement", () => ({
  judgeChannelEvent: mocks.judgeChannelEvent,
}));

vi.mock("../access", () => ({
  requireChannelSenderMapping: mocks.requireChannelSenderMapping,
}));

vi.mock("~/modules/channels/infrastructure/adapters", () => ({
  getChannelAdapter: () => ({
    label: "Slack",
    isReplyConfigured: () => true,
    sendReply: mocks.adapterSendReply,
  }),
}));

vi.mock("~/modules/conversations/application/manager", () => ({
  ConversationManager: {
    getInstance: mocks.conversationGetInstance,
  },
}));

vi.mock("~/infrastructure/providers/capabilities/messaging/delivery", async (importOriginal) => {
  const original =
    await importOriginal<
      typeof import("~/infrastructure/providers/capabilities/messaging/delivery")
    >();

  return {
    ...original,
    resolveStoredMessagingProvider: mocks.resolveStoredMessagingProvider,
  };
});

vi.mock("~/modules/responses/application/start", () => ({
  startResponse: mocks.startResponse,
}));

import { AI_DISCLOSURE_TEXT } from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import { fakeRepositories } from "~/infrastructure/database/__test__/fake-repositories";
import { ChannelBindingRepository } from "~/modules/channels/infrastructure/ChannelBindingRepository";
import { ChannelSenderRepository } from "~/modules/channels/infrastructure/ChannelSenderRepository";
import { ConversationRunRepository } from "~/modules/conversations/infrastructure/ConversationRunRepository";
import { MessageRepository } from "~/modules/conversations/infrastructure/MessageRepository";
import { OutboundDeliveryRepository } from "~/modules/delivery/infrastructure/OutboundDeliveryRepository";
import { CRISIS_SIGNPOST_TEXT } from "~/modules/responses/domain/crisis-signposting";
import { UserSettingsRepository } from "~/modules/user/infrastructure/UserSettingsRepository";

import { handleInboundChannelMessage, type InboundChannelTaskData } from "../inbound";

const env = { DB: {}, API_BASE_URL: "https://api.polychat.test" } as any;
const user = { id: 42, email: "user@example.com", plan_id: "pro" } as any;

function createContext(
  providerSettings: Record<string, unknown>[] = [],
  binding: Record<string, unknown> | null = null,
) {
  return {
    env,
    repositories: fakeRepositories([
      [
        UserSettingsRepository,
        {
          getProviderApiKeyForSettings: vi.fn(async () => "encrypted-config"),
          getUserProviderSettings: vi.fn(async () => providerSettings),
        },
      ],
      [
        ChannelBindingRepository,
        {
          getById: vi.fn(async () => binding),
        },
      ],
      [
        ChannelSenderRepository,
        {
          eligibleSender: mocks.eligibleSender,
        },
      ],
      [
        ConversationRunRepository,
        {
          getCommandReceipt: vi.fn(async () => null),
        },
      ],
      [
        MessageRepository,
        {
          getRunMessages: vi.fn(async () => []),
        },
      ],
      [
        OutboundDeliveryRepository,
        {
          isSent: mocks.disclosureSent,
          recordSent: mocks.recordSent,
          prepare: vi.fn(async () => ({})),
          begin: vi.fn(async () => "execute"),
          complete: vi.fn(async () => true),
          markIndeterminate: vi.fn(async () => undefined),
        },
      ],
    ]),
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
    mocks.disclosureSent.mockResolvedValue(true);
    mocks.resolveStoredMessagingProvider.mockReturnValue({
      provider: { send: mocks.providerSend },
      allowedSenders: ["+15551234567"],
    });
    mocks.startResponse.mockResolvedValue({
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
    expect(mocks.startResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        command: expect.objectContaining({
          stream: false,
          settings: expect.objectContaining({
            mode: "agent",
            max_steps: 3,
            enabled_tools: ["trigger_recipe", "get_task_status", "get_weather"],
            options: {
              channel: {
                id: "sms",
                from: "+15551234567",
                to: "+15557654321",
              },
            },
          }),
        }),
      }),
    );
    expect(mocks.providerSend).toHaveBeenCalledWith({
      to: "+15551234567",
      body: "chat reply",
    });
  });

  it("tells a sender they are talking to an AI on the first reply only", async () => {
    mocks.disclosureSent.mockResolvedValueOnce(false);

    await handleInboundChannelMessage({
      env,
      context: createContext(),
      user,
      data: createTaskData(),
    });

    expect(mocks.providerSend).toHaveBeenCalledWith({
      to: "+15551234567",
      body: `${AI_DISCLOSURE_TEXT}\n\nchat reply`,
    });
    expect(mocks.recordSent).toHaveBeenCalledWith(
      expect.objectContaining({
        id: expect.stringMatching(/^channel_disclosure_[0-9a-f]{40}$/),
        kind: "channel_disclosure",
        operationId: "SM123",
      }),
    );

    mocks.providerSend.mockClear();
    mocks.recordSent.mockClear();

    await handleInboundChannelMessage({
      env,
      context: createContext(),
      user,
      data: createTaskData(),
    });

    expect(mocks.providerSend).toHaveBeenCalledWith({
      to: "+15551234567",
      body: "chat reply",
    });
    expect(mocks.recordSent).not.toHaveBeenCalled();
  });

  it("keeps the disclosure owed when the first reply fails", async () => {
    mocks.disclosureSent.mockResolvedValueOnce(false);
    mocks.providerSend.mockRejectedValueOnce(new Error("provider down"));

    await expect(
      handleInboundChannelMessage({
        env,
        context: createContext(),
        user,
        data: createTaskData(),
      }),
    ).rejects.toThrow("provider down");

    expect(mocks.recordSent).not.toHaveBeenCalled();
  });

  describe("messages the assistant would not answer", () => {
    const binding = {
      id: "binding-1",
      enabled: true,
      channel: "slack",
      external_id: "T1:C1",
      created_by: user.id,
      scope_type: "personal",
      scope_id: String(user.id),
      teammate_id: null,
      interaction_mode: "automated",
      reaction_level: "off",
    };
    const bindingData = (body: string): InboundChannelTaskData => ({
      channel: "slack",
      bindingId: binding.id,
      senderMappingId: "sender-1",
      senderRevision: 1,
      messageContext: {
        externalId: binding.external_id,
        threadId: "thread-1",
        isDirect: false,
      },
      message: { messageId: "M1", from: "U1", body },
    });

    beforeEach(() => {
      mocks.judgeChannelEvent.mockResolvedValue({ shouldReply: false, needsAttention: false });
      mocks.eligibleSender.mockResolvedValue({
        id: "sender-1",
        user_id: user.id,
        sender_id: "U1",
        revision: 1,
      });
      mocks.requireChannelSenderMapping.mockResolvedValue({ binding });
    });

    it("still signposts a crisis message", async () => {
      const result = await handleInboundChannelMessage({
        env,
        context: createContext([], binding),
        user,
        data: bindingData("I want to kill myself"),
      });

      expect(result.status).toBe("ignored");
      expect(mocks.startResponse).not.toHaveBeenCalled();
      expect(mocks.adapterSendReply).toHaveBeenCalledWith(
        expect.objectContaining({ body: CRISIS_SIGNPOST_TEXT }),
        env,
      );
    });

    it("stays silent otherwise", async () => {
      await handleInboundChannelMessage({
        env,
        context: createContext([], binding),
        user,
        data: bindingData("lunch at noon?"),
      });

      expect(mocks.adapterSendReply).not.toHaveBeenCalled();
    });

    it("does not lose the outcome when signposting cannot be sent", async () => {
      mocks.adapterSendReply.mockRejectedValueOnce(new Error("slack down"));

      await expect(
        handleInboundChannelMessage({
          env,
          context: createContext([], binding),
          user,
          data: bindingData("I want to kill myself"),
        }),
      ).resolves.toMatchObject({ status: "ignored" });
    });
  });

  it("surfaces a busy conversation so the queue redelivers instead of interleaving", async () => {
    mocks.startResponse.mockRejectedValueOnce(
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
    expect(mocks.startResponse).not.toHaveBeenCalled();
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

    const [first] = mocks.startResponse.mock.calls[0];
    const [second] = mocks.startResponse.mock.calls[1];

    expect(second.command.conversationId).not.toBe(first.command.conversationId);
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

    const [call] = mocks.startResponse.mock.calls[0];

    expect(call.command.messages).toHaveLength(8);
    expect(call.command.messages[0].id).toBe("message-5");
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

    const [call] = mocks.startResponse.mock.calls[0];

    expect(call.command.messages[0].content).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "image_url",
          image_url: expect.objectContaining({ url: "https://api.twilio.com/media/1" }),
        }),
      ]),
    );
  });

  it("sends reply media that the configured provider can deliver", async () => {
    mocks.startResponse.mockResolvedValue({
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
    mocks.startResponse.mockResolvedValue({
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
