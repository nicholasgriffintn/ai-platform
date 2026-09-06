import { describe, expect, it } from "vitest";

import { SlackChannelAdapter } from "../adapters/SlackChannelAdapter";
import { TelegramChannelAdapter } from "../adapters/TelegramChannelAdapter";

const encoder = new TextEncoder();

async function slackSignature(secret: string, timestamp: string, body: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const digest = await crypto.subtle.sign("HMAC", key, encoder.encode(`v0:${timestamp}:${body}`));

  return `v0=${[...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("")}`;
}

function slackRequest(headers: Record<string, string>): Request {
  return new Request("https://example.test/webhook", { method: "POST", headers });
}

describe("SlackChannelAdapter", () => {
  const adapter = new SlackChannelAdapter();
  const secret = "slack-signing-secret";
  const body = JSON.stringify({ event: { type: "message", text: "hello" } });

  it("accepts a request Slack actually signed", async () => {
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signature = await slackSignature(secret, timestamp, body);

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
    const signature = await slackSignature("someone-elses-secret", timestamp, body);

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
    const signature = await slackSignature(secret, timestamp, body);

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
          event: { type: "message", channel: "C1", user: "U1", text: "ship it", ts: "1.2" },
        }),
      ),
    ).toEqual({
      kind: "message",
      messageId: "1.2",
      externalId: "C1",
      from: "U1",
      body: "ship it",
    });
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
      from: "2",
      body: "ship it",
    });
  });

  it("is personal only, so it can never bind to a project", () => {
    expect(adapter.scopes).toEqual(["personal"]);
  });
});
