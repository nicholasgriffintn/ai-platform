import { describe, expect, it } from "vitest";

import { signSlackRequest } from "../../../../../../test/channels/slack-signature";
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
        JSON.stringify({
          type: "event_callback",
          team_id: "T1",
          event: {
            type: "message",
            bot_id: "B1",
            text: "hi",
            channel: "C1",
            user: "U1",
            ts: "1.1",
            channel_type: "channel",
          },
        }),
      ),
    ).toMatchObject({ kind: "control" });
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
          message: {
            message_id: 1,
            chat: { id: 9, type: "private" },
            from: { id: 2, is_bot: true },
            text: "hi",
          },
        }),
      ),
    ).toMatchObject({ kind: "control" });
  });
});
