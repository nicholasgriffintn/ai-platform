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

import {
  initialiseChannelDatabase,
  channelTestContext,
  channelTestEnvironment,
} from "./channels/database";
import { signSlackRequest } from "./channels/slack-signature";

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

  await initialiseChannelDatabase(database);
  env = channelTestEnvironment(database);
  env.SLACK_SIGNING_SECRET = "test-signature";
  env.SLACK_BOT_TOKEN = "test-bot";
  owner = await channelTestContext(env, 1);
  member = await channelTestContext(env, 2);
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

    await member.repositories.conversations.createConversation(conversation, 2);
    await member.repositories.messages.createMessage(
      "private-history",
      conversation,
      "user",
      "Member's private history",
    );
    complete.mockResolvedValue({ choices: [{ message: { content: "Reply" } }] });
    vi.stubGlobal("fetch", async () => new Response(JSON.stringify({ ok: true })));
    await handleInboundChannelMessage({ context: member, env, user: member.requireUser(), data });
    expect(complete.mock.calls[0]?.[0].request.messages).toEqual(
      expect.arrayContaining([expect.objectContaining({ content: "Member's private history" })]),
    );

    const otherThread = receiptSchema.parse(
      await (await receive("C1", "U2", "Another thread", "2.2", "2.0")).json(),
    );
    const otherTask = await member.repositories.tasks.getTaskById(otherThread.taskId);
    const otherData = parseInboundChannelTaskData(otherTask?.task_data);

    if (!otherData) {
      throw new Error("Expected other thread task");
    }

    await handleInboundChannelMessage({
      context: member,
      env,
      user: member.requireUser(),
      data: otherData,
    });
    expect(complete.mock.calls[1]?.[0].request.messages).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ content: "Member's private history" })]),
    );

    const ownerChallenge = await issueChannelPairingChallenge(owner, binding.id);

    await receive("D8", "U1", ownerChallenge.command, "2.3", undefined, true);
    const otherSender = receiptSchema.parse(
      await (await receive("C1", "U1", "Owner message", "2.4", "1.0")).json(),
    );
    const ownerTask = await owner.repositories.tasks.getTaskById(otherSender.taskId);
    const ownerData = parseInboundChannelTaskData(ownerTask?.task_data);

    if (!ownerData) {
      throw new Error("Expected other sender task");
    }

    await handleInboundChannelMessage({
      context: owner,
      env,
      user: owner.requireUser(),
      data: ownerData,
    });
    expect(complete.mock.calls[2]?.[0].request.messages).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ content: "Member's private history" })]),
    );
    complete.mockClear();
    vi.unstubAllGlobals();
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
