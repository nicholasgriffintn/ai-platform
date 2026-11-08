import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  resolveStoredMessagingProvider: vi.fn(),
  startResponse: vi.fn(),
  conversationGetInstance: vi.fn(),
  conversationGet: vi.fn(),
  conversationArchiveMessages: vi.fn(),
  providerSend: vi.fn(),
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

import { fakeRepositories } from "~/infrastructure/database/__test__/fake-repositories";
import { ChannelBindingRepository } from "~/modules/channels/infrastructure/ChannelBindingRepository";
import { ChannelSenderRepository } from "~/modules/channels/infrastructure/ChannelSenderRepository";
import { ConversationRunRepository } from "~/modules/conversations/infrastructure/ConversationRunRepository";
import { MessageRepository } from "~/modules/conversations/infrastructure/MessageRepository";
import { OutboundDeliveryRepository } from "~/modules/delivery/infrastructure/OutboundDeliveryRepository";
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
});
