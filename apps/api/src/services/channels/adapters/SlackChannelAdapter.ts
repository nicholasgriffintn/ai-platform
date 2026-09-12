import { safeParseJson } from "~/utils/json";

import { requireSuccessfulChannelSend } from "./send-response";
import type { ChannelAdapter, ChannelIncoming, ChannelReply, ChannelVerification } from "./types";

const SLACK_SIGNATURE_VERSION = "v0";
const SIGNATURE_TOLERANCE_SECONDS = 5 * 60;
const SLACK_POST_MESSAGE_URL = "https://slack.com/api/chat.postMessage";

const encoder = new TextEncoder();

function toHex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function timingSafeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) {
    return false;
  }

  let mismatch = 0;

  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }

  return mismatch === 0;
}

/**
 * Slack signs every request with a timestamp and an HMAC over the raw body. Both are checked
 * before anything reaches a conversation, and a replayed request is refused on its timestamp.
 */
export class SlackChannelAdapter implements ChannelAdapter {
  readonly id = "slack" as const;
  readonly label = "Slack";
  readonly scopes = ["project", "personal"] as const;

  async verify(request: Request, secret: string, rawBody: string): Promise<ChannelVerification> {
    const timestamp = request.headers.get("x-slack-request-timestamp");
    const signature = request.headers.get("x-slack-signature");

    if (!secret || !timestamp || !signature) {
      return { ok: false, reason: "Missing Slack signature headers" };
    }

    const timestampSeconds = Number(timestamp);

    if (!Number.isSafeInteger(timestampSeconds) || timestampSeconds <= 0) {
      return { ok: false, reason: "Slack timestamp is not a whole number of seconds" };
    }

    if (Math.abs(Date.now() / 1000 - timestampSeconds) > SIGNATURE_TOLERANCE_SECONDS) {
      return { ok: false, reason: "Slack request is too old to accept" };
    }

    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const digest = await crypto.subtle.sign(
      "HMAC",
      key,
      encoder.encode(`${SLACK_SIGNATURE_VERSION}:${timestamp}:${rawBody}`),
    );
    const expected = `${SLACK_SIGNATURE_VERSION}=${toHex(digest)}`;

    return timingSafeEqual(expected, signature)
      ? { ok: true }
      : { ok: false, reason: "Slack signature did not match" };
  }

  parse(rawBody: string): ChannelIncoming {
    const payload = safeParseJson<Record<string, unknown>>(rawBody) ?? {};

    if (payload.type === "url_verification" && typeof payload.challenge === "string") {
      return { kind: "control", response: { challenge: payload.challenge } };
    }

    const event = payload.event;

    if (
      !event ||
      typeof event !== "object" ||
      (event as { type?: unknown }).type !== "message" ||
      (event as { bot_id?: unknown }).bot_id !== undefined ||
      (event as { subtype?: unknown }).subtype !== undefined
    ) {
      return { kind: "control", response: { ok: true, ignored: "not_a_user_message" } };
    }

    const typed = event as { channel?: string; user?: string; text?: string; ts?: string };

    if (!typed.channel || !typed.ts || !typed.text?.trim()) {
      return { kind: "control", response: { ok: true, ignored: "incomplete_message" } };
    }

    return {
      kind: "message",
      messageId: typed.ts,
      externalId: typed.channel,
      from: typed.user ?? typed.channel,
      body: typed.text,
    };
  }

  async sendReply(reply: ChannelReply, secret: string): Promise<void> {
    const response = await fetch(SLACK_POST_MESSAGE_URL, {
      method: "POST",
      headers: {
        authorization: `Bearer ${secret}`,
        "content-type": "application/json; charset=utf-8",
      },
      body: JSON.stringify({ channel: reply.externalId, text: reply.body }),
    });

    await requireSuccessfulChannelSend(response, "Slack");
  }
}
