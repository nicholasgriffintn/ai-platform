import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createServiceContext: vi.fn(),
  enqueueTask: vi.fn(),
}));

vi.mock("~/lib/context/serviceContext", () => ({
  createServiceContext: mocks.createServiceContext,
}));

vi.mock("~/services/tasks/TaskService", () => ({
  TaskService: class {
    enqueueTask = mocks.enqueueTask;
  },
}));

import { signSlackRequest } from "~/services/channels/__test__/slackSignature";
import { ErrorType } from "~/utils/errors";

import { handleChannelWebhook } from "../channels";

const env = {
  DB: {},
  SLACK_SIGNING_SECRET: "slack-signing-secret",
  SLACK_BOT_TOKEN: "xoxb-slack-bot-token",
  TELEGRAM_WEBHOOK_SECRET: "telegram-webhook-secret",
  TELEGRAM_BOT_TOKEN: "telegram-bot-token",
};

const slackBinding = {
  id: "binding-1",
  channel: "slack",
  scope_type: "project",
  scope_id: "project-1",
  external_id: "C123",
  enabled: true,
  created_by: 42,
};

const owner = { id: 42, email: "owner@example.com", plan_id: "pro" };

function createChannelContext(options: {
  channel: string;
  body: string;
  headers?: Record<string, string>;
}) {
  const request = new Request("https://api.polychat.test/webhooks/channels", {
    method: "POST",
    headers: options.headers ?? {},
    body: options.body,
  });

  return {
    env,
    req: {
      param: vi.fn((key: string) => (key === "channel" ? options.channel : "")),
      text: vi.fn(async () => options.body),
      raw: request,
    },
    get: vi.fn((key: string) => (key === "requestId" ? "request-1" : undefined)),
    json: vi.fn((body: unknown) => new Response(JSON.stringify(body))),
  } as any;
}

function prepareServiceContext(binding: Record<string, unknown> | null = slackBinding) {
  const repositories = {
    channelBindings: {
      getByExternalId: vi.fn(async () => binding),
    },
    users: {
      getUserById: vi.fn(async () => owner),
    },
    tasks: {},
  };

  mocks.createServiceContext.mockReturnValue({ env, database: {}, repositories });

  return repositories;
}

async function signedSlackContext(payload: unknown, secret = "slack-signing-secret") {
  const body = JSON.stringify(payload);
  const timestamp = String(Math.floor(Date.now() / 1000));

  return createChannelContext({
    channel: "slack",
    body,
    headers: {
      "x-slack-request-timestamp": timestamp,
      "x-slack-signature": await signSlackRequest(secret, timestamp, body),
    },
  });
}

const slackMessage = {
  event: { type: "message", channel: "C123", user: "U9", text: "what is the weather", ts: "171.1" },
};

describe("channel webhook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.enqueueTask.mockResolvedValue("inbound_message_task");
  });

  it("queues an inbound message for the owner of the bound channel", async () => {
    prepareServiceContext();

    const response = await handleChannelWebhook(await signedSlackContext(slackMessage));

    expect(await response.json()).toEqual({ success: true, taskId: "inbound_message_task" });
    expect(mocks.enqueueTask).toHaveBeenCalledWith(
      expect.objectContaining({
        task_type: "inbound_message",
        user_id: 42,
        task_data: {
          channel: "slack",
          bindingId: "binding-1",
          message: {
            messageId: "171.1",
            from: "U9",
            body: "what is the weather",
          },
        },
      }),
    );
  });

  it("refuses a Slack request signed with someone else's secret", async () => {
    prepareServiceContext();

    await expect(
      handleChannelWebhook(await signedSlackContext(slackMessage, "someone-elses-secret")),
    ).rejects.toMatchObject({ type: ErrorType.AUTHENTICATION_ERROR });
    expect(mocks.enqueueTask).not.toHaveBeenCalled();
  });

  it("refuses a replayed Slack request on its timestamp", async () => {
    prepareServiceContext();

    const body = JSON.stringify(slackMessage);
    const timestamp = String(Math.floor(Date.now() / 1000) - 60 * 60);
    const context = createChannelContext({
      channel: "slack",
      body,
      headers: {
        "x-slack-request-timestamp": timestamp,
        "x-slack-signature": await signSlackRequest("slack-signing-secret", timestamp, body),
      },
    });

    await expect(handleChannelWebhook(context)).rejects.toMatchObject({
      type: ErrorType.AUTHENTICATION_ERROR,
      message: "Slack request is too old to accept",
    });
    expect(mocks.enqueueTask).not.toHaveBeenCalled();
  });

  it("answers Slack's url verification challenge without queueing work", async () => {
    prepareServiceContext();

    const response = await handleChannelWebhook(
      await signedSlackContext({ type: "url_verification", challenge: "poly-challenge" }),
    );

    expect(await response.json()).toEqual({ challenge: "poly-challenge" });
    expect(mocks.enqueueTask).not.toHaveBeenCalled();
  });

  it("ignores a message from a channel nobody has connected", async () => {
    prepareServiceContext(null);

    const response = await handleChannelWebhook(await signedSlackContext(slackMessage));

    expect(await response.json()).toEqual({ success: true, ignored: "unbound_channel" });
    expect(mocks.enqueueTask).not.toHaveBeenCalled();
  });

  it("refuses a Telegram request carrying the wrong secret token", async () => {
    prepareServiceContext({ ...slackBinding, channel: "telegram", external_id: "5150" });

    const context = createChannelContext({
      channel: "telegram",
      body: JSON.stringify({ message: { message_id: 7, chat: { id: 5150 }, text: "hello" } }),
      headers: { "x-telegram-bot-api-secret-token": "not-the-registered-token" },
    });

    await expect(handleChannelWebhook(context)).rejects.toMatchObject({
      type: ErrorType.AUTHENTICATION_ERROR,
    });
    expect(mocks.enqueueTask).not.toHaveBeenCalled();
  });

  it("queues a Telegram message that carries the registered secret token", async () => {
    prepareServiceContext({ ...slackBinding, channel: "telegram", external_id: "5150" });

    const context = createChannelContext({
      channel: "telegram",
      body: JSON.stringify({
        message: { message_id: 7, chat: { id: 5150 }, from: { id: 99 }, text: "hello" },
      }),
      headers: { "x-telegram-bot-api-secret-token": "telegram-webhook-secret" },
    });

    await handleChannelWebhook(context);

    expect(mocks.enqueueTask).toHaveBeenCalledWith(
      expect.objectContaining({
        task_data: {
          channel: "telegram",
          bindingId: "binding-1",
          message: { messageId: "7", from: "99", body: "hello" },
        },
      }),
    );
  });
});
