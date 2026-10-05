import { Hono } from "hono";
import { Miniflare } from "miniflare";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import z from "zod/v4";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { createChannelBinding } from "~/modules/channels/application/bindings";
import {
  getChannelBindingConversationId,
  handleInboundChannelMessage,
  parseInboundChannelTaskData,
} from "~/modules/channels/application/inbound";
import {
  issueChannelPairingChallenge,
  revokeChannelSender,
} from "~/modules/channels/application/senders";
import { handleChannelWebhook } from "~/modules/webhooks/application/channels";
import type { IEnv } from "~/types";

import { signSlackRequest } from "./channels/slack-signature";
import {
  initialiseProjectWorkDatabase,
  projectWorkTestContext,
  projectWorkTestEnvironment,
} from "./project-work-database";

const complete = vi.hoisted(() => vi.fn());

vi.mock("~/modules/completions/application/createChatCompletions", () => ({
  handleCreateChatCompletions: complete,
}));

const runtime = new Miniflare({
  modules: true,
  script: "export default { fetch() { return new Response('test'); } }",
  compatibilityDate: "2026-08-01",
  d1Databases: ["DB"],
});
const app = new Hono<{ Bindings: IEnv }>();
const receiptSchema = z.object({ taskId: z.string().min(1) });

app.post("/webhooks/channels/:channel", handleChannelWebhook);
let owner: ServiceContext;
let member: ServiceContext;
let env: IEnv;

beforeAll(async () => {
  const database = await runtime.getD1Database("DB");

  await initialiseProjectWorkDatabase(database);
  env = projectWorkTestEnvironment(database);
  env.SLACK_SIGNING_SECRET = "test-signature";
  env.SLACK_BOT_TOKEN = "test-bot";
  owner = await projectWorkTestContext(env, 1);
  member = await projectWorkTestContext(env, 2);
});
afterAll(async () => {
  vi.unstubAllGlobals();
  await runtime.dispose();
});

async function receive(
  channelId: string,
  sender: string,
  body: string,
  timestamp: string,
  threadId?: string,
  isDirect = false,
) {
  const payload = JSON.stringify({
    type: "event_callback",
    team_id: "T1",
    event: {
      type: "message",
      channel: channelId,
      user: sender,
      text: body,
      ts: timestamp,
      thread_ts: threadId,
      channel_type: isDirect ? "im" : "channel",
    },
  });
  const time = String(Math.floor(Date.now() / 1000));

  return app.request(
    "/webhooks/channels/slack",
    {
      method: "POST",
      body: payload,
      headers: {
        "x-slack-request-timestamp": time,
        "x-slack-signature": await signSlackRequest("test-signature", time, payload),
      },
    },
    env,
  );
}

describe("verified channel sender authority", () => {
  it("links the actual member once, isolates their threads and rejects a revoked queued message", async () => {
    const binding = await createChannelBinding(owner, {
      channel: "slack",
      externalId: "T1:C1",
      projectId: "project",
      interactionMode: "direct",
    });
    const challenge = await issueChannelPairingChallenge(member, binding.id);

    expect(
      await (await receive("D9", "U2", challenge.command, "1.1", undefined, true)).json(),
    ).toMatchObject({ linked: true });
    expect(
      await (await receive("D9", "U3", challenge.command, "1.2", undefined, true)).json(),
    ).toMatchObject({ linked: false });
    expect(await (await receive("C1", "U3", "Unlinked message", "1.3")).json()).toMatchObject({
      ignored: "unverified_sender",
    });
    const accepted = receiptSchema.parse(
      await (await receive("C1", "U2", "Member message", "2.1", "1.0")).json(),
    );
    const queued = await owner.repositories.tasks.getTaskById(accepted.taskId);

    expect(queued?.user_id).toBe(2);
    const data = parseInboundChannelTaskData(queued?.task_data);

    if (!data || !("bindingId" in data)) {
      throw new Error("Expected verified binding task");
    }

    expect(data.messageContext.threadId).toBe("1.0");
    const identity = {
      channel: "slack" as const,
      bindingId: binding.id,
      externalId: "T1:C1",
      userId: 2,
      senderId: "T1:U2",
      threadId: "1.0",
    };
    const conversation = await getChannelBindingConversationId(identity);

    expect(await getChannelBindingConversationId({ ...identity, threadId: "2.0" })).not.toBe(
      conversation,
    );
    expect(
      await getChannelBindingConversationId({ ...identity, userId: 1, senderId: "T1:U1" }),
    ).not.toBe(conversation);
    await revokeChannelSender(owner, binding.id, data.senderMappingId, data.senderRevision);
    expect(
      await handleInboundChannelMessage({ context: member, env, user: member.requireUser(), data }),
    ).toMatchObject({ status: "unauthorised_sender" });
    expect(complete).not.toHaveBeenCalled();
  });

  it("keeps personal accounts out of group chats and rechecks project membership before queueing", async () => {
    const personal = await createChannelBinding(owner, {
      channel: "slack",
      externalId: "T1:D1",
      interactionMode: "direct",
    });
    let challenge = await issueChannelPairingChallenge(owner, personal.id);

    expect(await (await receive("D1", "U1", challenge.command, "3.1")).json()).toMatchObject({
      linked: false,
    });
    challenge = await issueChannelPairingChallenge(owner, personal.id);
    expect(
      await (await receive("D1", "U1", challenge.command, "3.2", undefined, true)).json(),
    ).toMatchObject({ linked: true });
    expect(
      await (await receive("D1", "U1", "Do not expose my account", "3.3")).json(),
    ).toMatchObject({ ignored: "unverified_sender" });
    const binding = await createChannelBinding(owner, {
      channel: "slack",
      externalId: "T1:C2",
      projectId: "project",
    });
    const projectChallenge = await issueChannelPairingChallenge(member, binding.id);

    await receive("D9", "U2", projectChallenge.command, "4.1", undefined, true);
    await env.DB.prepare(
      "DELETE FROM workspace_member WHERE workspace_id = 'workspace' AND user_id = 2",
    ).run();
    expect(await (await receive("C2", "U2", "Removed member", "4.2")).json()).toMatchObject({
      ignored: "unverified_sender",
    });
    await env.DB.prepare(
      "INSERT INTO workspace_member (workspace_id, user_id, role) VALUES ('workspace', 2, 'member')",
    ).run();
  });

  it("withholds an answer when the sender is revoked during generation", async () => {
    const binding = await createChannelBinding(owner, {
      channel: "slack",
      externalId: "T1:C3",
      projectId: "project",
      interactionMode: "direct",
    });
    const challenge = await issueChannelPairingChallenge(member, binding.id);

    await receive("D9", "U2", challenge.command, "5.1", undefined, true);
    const receipt = receiptSchema.parse(
      await (await receive("C3", "U2", "Please reply", "5.2", "5.0")).json(),
    );
    const task = await owner.repositories.tasks.getTaskById(receipt.taskId);
    const data = parseInboundChannelTaskData(task?.task_data);

    if (!data || !("bindingId" in data)) {
      throw new Error("Expected verified binding task");
    }

    complete.mockImplementationOnce(async () => {
      await revokeChannelSender(owner, binding.id, data.senderMappingId, data.senderRevision);

      return { choices: [{ message: { content: "Private answer" } }] };
    });
    const send = vi.fn();

    vi.stubGlobal("fetch", send);
    await expect(
      handleInboundChannelMessage({ context: member, env, user: member.requireUser(), data }),
    ).rejects.toMatchObject({ statusCode: 403 });
    expect(send).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
