import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createServiceContext: vi.fn(),
  resolveStoredMessagingProvider: vi.fn(),
  enqueueTask: vi.fn(),
  providerSend: vi.fn(),
  providerParseIncoming: vi.fn(),
}));

vi.mock("~/lib/context/serviceContext", () => ({
  createServiceContext: mocks.createServiceContext,
}));

vi.mock("~/lib/providers/capabilities/messaging/delivery", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("~/lib/providers/capabilities/messaging/delivery")>();

  return {
    ...original,
    resolveStoredMessagingProvider: mocks.resolveStoredMessagingProvider,
  };
});

vi.mock("~/services/tasks/TaskService", () => ({
  TaskService: class {
    enqueueTask = mocks.enqueueTask;
  },
}));

import { handleSmsAssistantWebhook } from "../sms";

const testUser = {
  id: 42,
  email: "user@example.com",
  plan_id: "pro",
};

function createMockContext(options: { providerId?: string; providerSettingsId?: string } = {}) {
  const providerId = options.providerId ?? "twilio-sms";
  const providerSettingsId = options.providerSettingsId ?? "provider-row-1";

  return {
    env: { DB: {}, API_BASE_URL: "https://api.polychat.test" },
    req: {
      param: vi.fn((key: string) =>
        key === "providerId" ? providerId : key === "providerSettingsId" ? providerSettingsId : "",
      ),
    },
    get: vi.fn((key: string) => (key === "requestId" ? "request-1" : undefined)),
    json: vi.fn((body: unknown) => new Response(JSON.stringify(body))),
  } as any;
}

function prepareServiceContext() {
  const repositories = {
    userSettings: {
      getProviderSettingsById: vi.fn(async () => ({
        id: "provider-row-1",
        user_id: 42,
        provider_id: "twilio-sms",
        enabled: 1,
      })),
      getProviderApiKeyForSettings: vi.fn(async () => "encrypted-config"),
    },
    users: {
      getUserById: vi.fn(async () => testUser),
    },
    tasks: {},
  };

  mocks.createServiceContext.mockReturnValue({
    env: { DB: {}, API_BASE_URL: "https://api.polychat.test" },
    database: {},
    repositories,
    requestCache: new Map(),
  });

  return repositories;
}

describe("SMS webhook service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.providerParseIncoming.mockResolvedValue({
      kind: "message",
      messageId: "SM123",
      from: "+15551234567",
      to: "+15557654321",
      body: "hello",
    });
    mocks.resolveStoredMessagingProvider.mockReturnValue({
      provider: {
        parseIncoming: mocks.providerParseIncoming,
        send: mocks.providerSend,
      },
      allowedSenders: ["+15551234567"],
    });
    mocks.enqueueTask.mockResolvedValue("inbound_message_task");
  });

  it("queues an inbound message from an allowed sender instead of answering inline", async () => {
    prepareServiceContext();

    await handleSmsAssistantWebhook(createMockContext());

    expect(mocks.providerSend).not.toHaveBeenCalled();
    expect(mocks.enqueueTask).toHaveBeenCalledWith(
      expect.objectContaining({
        task_type: "inbound_message",
        user_id: 42,
        task_data: {
          channel: "sms",
          providerId: "twilio-sms",
          providerSettingsId: "provider-row-1",
          message: {
            messageId: "SM123",
            from: "+15551234567",
            to: "+15557654321",
            body: "hello",
          },
        },
      }),
    );
  });

  it("derives a stable task id from the provider message id so retries do not run twice", async () => {
    prepareServiceContext();

    await handleSmsAssistantWebhook(createMockContext());
    await handleSmsAssistantWebhook(createMockContext());

    const [first] = mocks.enqueueTask.mock.calls[0];
    const [second] = mocks.enqueueTask.mock.calls[1];

    expect(first.id).toMatch(/^inbound_message_[0-9a-f]{40}$/);
    expect(second.id).toBe(first.id);
  });

  it("gives a different task id to a different provider message", async () => {
    prepareServiceContext();

    await handleSmsAssistantWebhook(createMockContext());
    mocks.providerParseIncoming.mockResolvedValue({
      kind: "message",
      messageId: "SM124",
      from: "+15551234567",
      to: "+15557654321",
      body: "hello again",
    });
    await handleSmsAssistantWebhook(createMockContext());

    const [first] = mocks.enqueueTask.mock.calls[0];
    const [second] = mocks.enqueueTask.mock.calls[1];

    expect(second.id).not.toBe(first.id);
  });

  it("ignores messages from senders outside the allow list without replying", async () => {
    prepareServiceContext();
    mocks.providerParseIncoming.mockResolvedValue({
      kind: "message",
      messageId: "SM999",
      from: "+15550009999",
      to: "+15557654321",
      body: "let me in",
    });

    const response = await handleSmsAssistantWebhook(createMockContext());

    expect(await response.json()).toEqual({ success: true, ignored: "unauthorised_sender" });
    expect(mocks.enqueueTask).not.toHaveBeenCalled();
    expect(mocks.providerSend).not.toHaveBeenCalled();
  });

  it("ignores every sender when no allow list has been configured", async () => {
    prepareServiceContext();
    mocks.resolveStoredMessagingProvider.mockReturnValue({
      provider: {
        parseIncoming: mocks.providerParseIncoming,
        send: mocks.providerSend,
      },
      allowedSenders: [],
    });

    await handleSmsAssistantWebhook(createMockContext());

    expect(mocks.enqueueTask).not.toHaveBeenCalled();
  });

  it("matches allowed senders that were saved in a different format", async () => {
    prepareServiceContext();
    mocks.resolveStoredMessagingProvider.mockReturnValue({
      provider: {
        parseIncoming: mocks.providerParseIncoming,
        send: mocks.providerSend,
      },
      allowedSenders: ["+15551234567"],
    });
    mocks.providerParseIncoming.mockResolvedValue({
      kind: "message",
      messageId: "SM125",
      from: "+1 (555) 123-4567",
      to: "+15557654321",
      body: "hello",
    });

    await handleSmsAssistantWebhook(createMockContext());

    expect(mocks.enqueueTask).toHaveBeenCalledTimes(1);
  });

  it("returns provider control responses without queueing assistant work", async () => {
    prepareServiceContext();
    mocks.providerParseIncoming.mockResolvedValue({
      kind: "control",
      response: { success: true, message: "AWS SNS subscription confirmed" },
    });

    const response = await handleSmsAssistantWebhook(createMockContext());

    expect(await response.json()).toEqual({
      success: true,
      message: "AWS SNS subscription confirmed",
    });
    expect(mocks.enqueueTask).not.toHaveBeenCalled();
  });
});
