import { describe, expect, it, vi } from "vitest";

import { signSlackRequest } from "../../../../../../test/slack-signature";
import { SlackChannelAdapter } from "../SlackChannelAdapter";
import { TelegramChannelAdapter } from "../TelegramChannelAdapter";

function slackRequest(headers: Record<string, string>): Request {
  return new Request("https://example.test/webhook", { method: "POST", headers });
}

describe("SlackChannelAdapter", () => {
  const adapter = new SlackChannelAdapter();
  const secret = "slack-signing-secret";
  const body = JSON.stringify({ event: { type: "message", text: "hello" } });

  it("accepts a request Slack actually signed", async () => {
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signature = await signSlackRequest(secret, timestamp, body);

    await expect(
      adapter.verify(
        slackRequest({ "x-slack-request-timestamp": timestamp, "x-slack-signature": signature }),
        secret,
        body,
      ),
    ).resolves.toMatchObject({ ok: true });
  });

  it("refuses a signature computed with a different secret", async () => {
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signature = await signSlackRequest("someone-elses-secret", timestamp, body);

    await expect(
      adapter.verify(
        slackRequest({ "x-slack-request-timestamp": timestamp, "x-slack-signature": signature }),
        secret,
        body,
      ),
    ).resolves.toMatchObject({ ok: false });
  });

  it("refuses a replayed request on its timestamp", async () => {
    const timestamp = String(Math.floor(Date.now() / 1000) - 60 * 60);
    const signature = await signSlackRequest(secret, timestamp, body);

    await expect(
      adapter.verify(
        slackRequest({ "x-slack-request-timestamp": timestamp, "x-slack-signature": signature }),
        secret,
        body,
      ),
    ).resolves.toMatchObject({ ok: false, reason: "Slack request is too old to accept" });
  });

  it("answers Slack's url verification handshake without starting a conversation", () => {
    expect(
      adapter.parse(JSON.stringify({ type: "url_verification", challenge: "abc123" })),
    ).toEqual({ kind: "control", response: { challenge: "abc123" } });
  });

  it("ignores its own messages so it cannot answer itself", () => {
    expect(
      adapter.parse(
        JSON.stringify({ event: { type: "message", bot_id: "B1", text: "hi", channel: "C1" } }),
      ),
    ).toMatchObject({ kind: "control" });
  });

  it("reads a real message into the shared shape", () => {
    expect(
      adapter.parse(
        JSON.stringify({
          team_id: "T1",
          event: { type: "message", channel: "C1", user: "U1", text: "ship it", ts: "1.2" },
        }),
      ),
    ).toEqual({
      kind: "message",
      messageId: "1.2",
      externalId: "C1",
      workspaceId: "T1",
      threadId: "1.2",
      mentioned: false,
      directMessage: false,
      from: "U1",
      body: "ship it",
    });
  });
  it("retains the root thread and recognises an app mention", () => {
    expect(
      adapter.parse(
        JSON.stringify({
          team_id: "T1",
          event: {
            type: "app_mention",
            channel: "C1",
            user: "U1",
            text: "<@UBOT> explain",
            ts: "2.2",
            thread_ts: "1.2",
          },
        }),
        { botUserId: "UBOT" },
      ),
    ).toMatchObject({ threadId: "1.2", mentioned: true, body: "explain" });
  });

  it("rejects a signed event without a workspace or sender identity", () => {
    expect(
      adapter.parse(
        JSON.stringify({ event: { type: "message", channel: "C1", text: "hello", ts: "1.2" } }),
      ),
    ).toMatchObject({ kind: "control" });
  });

  it("posts a reply inside the original Slack thread", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true })));

    vi.stubGlobal("fetch", fetcher);

    try {
      await adapter.sendReply({ externalId: "C1", threadId: "1.2", body: "reply" }, "bot-token");
      expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({
        channel: "C1",
        thread_ts: "1.2",
        text: "reply",
      });
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe("TelegramChannelAdapter", () => {
  const adapter = new TelegramChannelAdapter();

  it("accepts the secret token it registered with", async () => {
    const request = new Request("https://example.test/webhook", {
      method: "POST",
      headers: { "x-telegram-bot-api-secret-token": "shared-token" },
    });

    await expect(adapter.verify(request, "shared-token", "")).resolves.toMatchObject({ ok: true });
  });

  it("refuses a request carrying the wrong token", async () => {
    const request = new Request("https://example.test/webhook", {
      method: "POST",
      headers: { "x-telegram-bot-api-secret-token": "guessed" },
    });

    await expect(adapter.verify(request, "shared-token", "")).resolves.toMatchObject({
      ok: false,
    });
  });

  it("refuses a request with no token at all", async () => {
    const request = new Request("https://example.test/webhook", { method: "POST" });

    await expect(adapter.verify(request, "shared-token", "")).resolves.toMatchObject({ ok: false });
  });

  it("ignores messages from other bots", () => {
    expect(
      adapter.parse(
        JSON.stringify({
          message: { message_id: 1, chat: { id: 9 }, from: { id: 2, is_bot: true }, text: "hi" },
        }),
      ),
    ).toMatchObject({ kind: "control" });
  });

  it("reads a real message into the shared shape", () => {
    expect(
      adapter.parse(
        JSON.stringify({
          message: { message_id: 42, chat: { id: 9 }, from: { id: 2 }, text: "ship it" },
        }),
      ),
    ).toEqual({
      kind: "message",
      messageId: "42",
      externalId: "9",
      workspaceId: "",
      threadId: "9",
      mentioned: false,
      directMessage: true,
      from: "2",
      body: "ship it",
    });
  });

  it("is personal only, so it can never bind to a project", () => {
    expect(adapter.scopes).toEqual(["personal"]);
  });
});
