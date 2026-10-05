import { timingSafeEqual, toHex } from "@ngriffin_uk/polychat-utility-server/crypto";

import type {
  ChannelAdapter,
  ChannelIncoming,
  ChannelReply,
  ChannelVerification,
} from "~/modules/channels/application/ports/channel-adapter";

import { requireSuccessfulChannelSend } from "./send-response";
import { parseSlackEvent } from "./slack-events";

const SLACK_SIGNATURE_VERSION = "v0";
const SIGNATURE_TOLERANCE_SECONDS = 5 * 60;
const SLACK_POST_MESSAGE_URL = "https://slack.com/api/chat.postMessage";

const encoder = new TextEncoder();

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

  parse(rawBody: string, options?: { botUserId?: string }): ChannelIncoming {
    return parseSlackEvent(rawBody, options?.botUserId);
  }

  async sendReply(reply: ChannelReply, secret: string): Promise<void> {
    const response = await fetch(SLACK_POST_MESSAGE_URL, {
      method: "POST",
      redirect: "error",
      signal: AbortSignal.timeout(10_000),
      headers: {
        authorization: `Bearer ${secret}`,
        "content-type": "application/json; charset=utf-8",
      },
      body: JSON.stringify({
        channel: reply.externalId,
        text: reply.body,
        thread_ts: reply.threadId,
      }),
    });

    await requireSuccessfulChannelSend(response, "Slack");
  }
}
