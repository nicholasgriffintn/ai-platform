import { slackChannelAddressSchema } from "@ngriffin_uk/polychat-schemas";
import { timingSafeEqual, toHex } from "@ngriffin_uk/polychat-utility-server/crypto";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import {
  CHANNEL_TOP_LEVEL_THREAD,
  type ChannelIncoming,
  type ChannelReply,
  type ChannelVerification,
  type WebhookChannelAdapter,
} from "~/modules/channels/application/ports/channel-adapter";
import { getChannelSecrets } from "~/modules/channels/application/secrets";
import type { IEnv } from "~/types";

import { parseSlackMessage } from "./channel-payloads";
import { requireSuccessfulChannelSend } from "./send-response";

const SLACK_SIGNATURE_VERSION = "v0";
const SIGNATURE_TOLERANCE_SECONDS = 5 * 60;
const SLACK_POST_MESSAGE_URL = "https://slack.com/api/chat.postMessage";

const encoder = new TextEncoder();

/**
 * Slack signs every request with a timestamp and an HMAC over the raw body. Both are checked
 * before anything reaches a conversation, and a replayed request is refused on its timestamp.
 */
export class SlackChannelAdapter implements WebhookChannelAdapter {
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
    return parseSlackMessage(rawBody);
  }

  isReplyConfigured(env: IEnv): boolean {
    return Boolean(getChannelSecrets(this.id, env).reply);
  }

  async sendReply(reply: ChannelReply, env: IEnv): Promise<void> {
    const secret = getChannelSecrets(this.id, env).reply;

    if (!secret) {
      throw new AssistantError(
        "Slack has no reply credential configured",
        ErrorType.CONFIGURATION_ERROR,
      );
    }

    const parsed = slackChannelAddressSchema.safeParse(reply.externalId);
    const channelId = parsed.success ? parsed.data.split(":")[1] : null;

    if (!channelId) {
      throw new AssistantError("Invalid Slack destination", ErrorType.PARAMS_ERROR, 400);
    }

    const response = await fetch(SLACK_POST_MESSAGE_URL, {
      method: "POST",
      headers: {
        authorization: `Bearer ${secret}`,
        "content-type": "application/json; charset=utf-8",
      },
      body: JSON.stringify({
        channel: channelId,
        text: reply.body,
        ...(reply.threadId === CHANNEL_TOP_LEVEL_THREAD ? {} : { thread_ts: reply.threadId }),
      }),
    });

    await requireSuccessfulChannelSend(response, "Slack");
  }
}
