import { Hono } from "hono";
import { Miniflare } from "miniflare";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createServiceContext: vi.fn(),
  enqueueTask: vi.fn(),
}));

vi.mock("~/infrastructure/context/serviceContext", () => ({
  createServiceContext: mocks.createServiceContext,
}));

vi.mock("~/modules/workspaces/application/access", () => ({
  requireProjectAccess: vi.fn(async () => ({ role: "admin" })),
}));

vi.mock("~/modules/tasks/application/TaskService", () => ({
  TaskService: class {
    enqueueTask = mocks.enqueueTask;
  },
}));

import { ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import type { ChannelBindingRow } from "~/infrastructure/database/schema";
import type { IEnv } from "~/types";

import {
  channelTestBinding,
  channelTestEnvironment,
  channelTestThread,
  channelTestUser,
} from "../../../../../test/fixtures/channels";
import { signSlackRequest } from "../../../../../test/helpers/slack-signature";
import { handleChannelWebhook } from "../channels";

const runtime = new Miniflare({
  modules: true,
  script: "export default { fetch() { return new Response('test'); } }",
  compatibilityDate: "2026-08-01",
  d1Databases: ["DB"],
});
let env: IEnv;
let createActualServiceContext: typeof import("~/infrastructure/context/serviceContext").createServiceContext;
const slackBinding: ChannelBindingRow = {
  ...channelTestBinding,
  scope_type: "project",
  scope_id: "project-1",
};
const owner = channelTestUser;
const app = new Hono<{ Bindings: IEnv }>();

app.post("/webhooks/channels/:channel", handleChannelWebhook);
app.onError((error) => {
  throw error;
});

beforeAll(async () => {
  env = channelTestEnvironment(await runtime.getD1Database("DB"), {
    SLACK_SIGNING_SECRET: "slack-signing-secret",
    SLACK_BOT_USER_ID: "UBOT",
    SLACK_BOT_TOKEN: "xoxb-slack-bot-token",
    TELEGRAM_WEBHOOK_SECRET: "telegram-webhook-secret",
    TELEGRAM_BOT_TOKEN: "telegram-bot-token",
  });
  createActualServiceContext = (
    await vi.importActual<typeof import("~/infrastructure/context/serviceContext")>(
      "~/infrastructure/context/serviceContext",
    )
  ).createServiceContext;
});
afterAll(() => runtime.dispose());
afterEach(() => vi.unstubAllGlobals());

function createChannelContext(options: {
  channel: string;
  body: string;
  headers?: Record<string, string>;
}) {
  return new Request(`https://api.polychat.test/webhooks/channels/${options.channel}`, {
    method: "POST",
    headers: options.headers ?? {},
    body: options.body,
  });
}

function dispatch(request: Request) {
  return app.fetch(request, env);
}

function prepareServiceContext(
  binding: ChannelBindingRow | null = slackBinding,
): ServiceContext["repositories"] {
  const context = createActualServiceContext({ env, user: owner });

  vi.spyOn(context.repositories.channelBindings, "findByExternalId").mockResolvedValue(binding);
  vi.spyOn(context.repositories.channelBindings, "getById").mockResolvedValue(binding);
  vi.spyOn(context.repositories.users, "getUserById").mockResolvedValue(owner);
  vi.spyOn(context.repositories.channelThreads, "admit").mockResolvedValue(channelTestThread);
  mocks.createServiceContext.mockReturnValue(context);

  return context.repositories;
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
  team_id: "T123",
  event: { type: "message", channel: "C123", user: "U9", text: "what is the weather", ts: "171.1" },
};

describe("channel webhook", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    mocks.enqueueTask.mockResolvedValue("inbound_message_task");
  });

  it("queues an inbound message for the owner of the bound channel", async () => {
    prepareServiceContext();

    const response = await dispatch(await signedSlackContext(slackMessage));

    expect(await response.json()).toEqual({ success: true, taskId: "inbound_message_task" });
    expect(mocks.enqueueTask).toHaveBeenCalledWith(
      expect.objectContaining({
        task_type: "inbound_message",
        user_id: 42,
        task_data: {
          channel: "slack",
          bindingId: "binding-1",
          thread: {
            workspaceId: "T123",
            externalId: "C123",
            threadId: "171.1",
            revision: 1,
            bindingRevision: 1,
          },
          message: {
            messageId: "171.1",
            from: "U9",
            body: "what is the weather",
          },
        },
      }),
    );
  });

  it("does not queue work for a sender outside the binding allowlist", async () => {
    prepareServiceContext({ ...slackBinding, allowed_sender_ids: '["U42"]' });

    const response = await dispatch(await signedSlackContext(slackMessage));

    expect(await response.json()).toEqual({ success: true, ignored: "unauthorised_sender" });
    expect(mocks.enqueueTask).not.toHaveBeenCalled();
  });

  it("leaves an unmentioned inactive thread alone", async () => {
    const repositories = prepareServiceContext({ ...slackBinding, reply_mode: "mentions" });

    vi.mocked(repositories.channelThreads.admit).mockResolvedValueOnce(null);

    const response = await dispatch(await signedSlackContext(slackMessage));

    expect(repositories.channelThreads.admit).toHaveBeenCalledWith(
      expect.objectContaining({ activate: false }),
    );
    expect(await response.json()).toEqual({ success: true, ignored: "inactive_thread" });
    expect(mocks.enqueueTask).not.toHaveBeenCalled();
  });

  it("refuses a Slack request signed with someone else's secret", async () => {
    prepareServiceContext();

    await expect(
      dispatch(await signedSlackContext(slackMessage, "someone-elses-secret")),
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

    await expect(dispatch(context)).rejects.toMatchObject({
      type: ErrorType.AUTHENTICATION_ERROR,
      message: "Slack request is too old to accept",
    });
    expect(mocks.enqueueTask).not.toHaveBeenCalled();
  });

  it("answers Slack's url verification challenge without queueing work", async () => {
    prepareServiceContext();

    const response = await dispatch(
      await signedSlackContext({ type: "url_verification", challenge: "poly-challenge" }),
    );

    expect(await response.json()).toEqual({ challenge: "poly-challenge" });
    expect(mocks.enqueueTask).not.toHaveBeenCalled();
  });

  it("ignores a message from a channel nobody has connected", async () => {
    prepareServiceContext(null);

    const response = await dispatch(await signedSlackContext(slackMessage));

    expect(await response.json()).toEqual({ success: true, ignored: "unbound_channel" });
    expect(mocks.enqueueTask).not.toHaveBeenCalled();
  });

  it("refuses a Telegram request carrying the wrong secret token", async () => {
    prepareServiceContext({
      ...slackBinding,
      channel: "telegram",
      external_id: "5150",
      workspace_id: "",
      allowed_sender_ids: JSON.stringify(["99"]),
    });

    const context = createChannelContext({
      channel: "telegram",
      body: JSON.stringify({ message: { message_id: 7, chat: { id: 5150 }, text: "hello" } }),
      headers: { "x-telegram-bot-api-secret-token": "not-the-registered-token" },
    });

    await expect(dispatch(context)).rejects.toMatchObject({
      type: ErrorType.AUTHENTICATION_ERROR,
    });
    expect(mocks.enqueueTask).not.toHaveBeenCalled();
  });

  it("queues a Telegram message that carries the registered secret token", async () => {
    prepareServiceContext({
      ...slackBinding,
      channel: "telegram",
      external_id: "5150",
      workspace_id: "",
      allowed_sender_ids: JSON.stringify(["99"]),
    });

    const context = createChannelContext({
      channel: "telegram",
      body: JSON.stringify({
        message: { message_id: 7, chat: { id: 5150 }, from: { id: 99 }, text: "hello" },
      }),
      headers: { "x-telegram-bot-api-secret-token": "telegram-webhook-secret" },
    });

    await dispatch(context);

    expect(mocks.enqueueTask).toHaveBeenCalledWith(
      expect.objectContaining({
        task_data: {
          channel: "telegram",
          bindingId: "binding-1",
          thread: {
            workspaceId: "",
            externalId: "5150",
            threadId: "5150",
            revision: 1,
            bindingRevision: 1,
          },
          message: { messageId: "7", from: "99", body: "hello" },
        },
      }),
    );
  });
});
