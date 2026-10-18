import { slackChannelAddressSchema } from "@ngriffin_uk/polychat-schemas";
import { timingSafeEqual, toHex } from "@ngriffin_uk/polychat-utility-server/crypto";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import {
  CHANNEL_TOP_LEVEL_THREAD,
  type ChannelIncoming,
  type ChannelMessageRef,
  type ChannelReaction,
  type ChannelReply,
  type ChannelVerification,
  type WebhookChannelAdapter,
} from "~/modules/channels/application/ports/channel-adapter";
import { getChannelSecrets } from "~/modules/channels/application/secrets";
import type { IEnv } from "~/types";

import { parseSlackMessage } from "./channel-payloads";
import { requireSuccessfulChannelSend } from "./send-response";
import { toSlackEmojiName } from "./slack-emoji";

const SLACK_SIGNATURE_VERSION = "v0";
const SIGNATURE_TOLERANCE_SECONDS = 5 * 60;
const SLACK_POST_MESSAGE_URL = "https://slack.com/api/chat.postMessage";
const SLACK_REACTION_ADD_URL = "https://slack.com/api/reactions.add";
const SLACK_REACTION_REMOVE_URL = "https://slack.com/api/reactions.remove";
const SLACK_THREAD_STATUS_URL = "https://slack.com/api/assistant.threads.setStatus";
const SLACK_WORKING_STATUS = "is working on it…";

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
    await this.call(
      SLACK_POST_MESSAGE_URL,
      {
        channel: this.channelId(reply.externalId),
        text: reply.body,
        ...(reply.threadId === CHANNEL_TOP_LEVEL_THREAD ? {} : { thread_ts: reply.threadId }),
      },
      env,
    );
  }

  async react(target: ChannelMessageRef, reaction: ChannelReaction, env: IEnv): Promise<void> {
    const name = toSlackEmojiName(reaction.emoji);

    if (!name) {
      return;
    }

    await this.call(
      reaction.remove ? SLACK_REACTION_REMOVE_URL : SLACK_REACTION_ADD_URL,
      { channel: this.channelId(target.externalId), timestamp: target.messageId, name },
      env,
    );
  }

  async showWorking(target: ChannelMessageRef, env: IEnv): Promise<void> {
    if (target.threadId === CHANNEL_TOP_LEVEL_THREAD) {
      return;
    }

    await this.call(
      SLACK_THREAD_STATUS_URL,
      {
        channel_id: this.channelId(target.externalId),
        thread_ts: target.threadId,
        status: SLACK_WORKING_STATUS,
      },
      env,
    );
  }

  private channelId(externalId: string): string {
    const parsed = slackChannelAddressSchema.safeParse(externalId);
    const channelId = parsed.success ? parsed.data.split(":")[1] : null;

    if (!channelId) {
      throw new AssistantError("Invalid Slack destination", ErrorType.PARAMS_ERROR, 400);
    }

    return channelId;
  }

  private async call(url: string, body: Record<string, unknown>, env: IEnv): Promise<void> {
    const secret = getChannelSecrets(this.id, env).reply;

    if (!secret) {
      throw new AssistantError(
        "Slack has no reply credential configured",
        ErrorType.CONFIGURATION_ERROR,
      );
    }

    const response = await fetch(url, {
      method: "POST",
      headers: {
        authorization: `Bearer ${secret}`,
        "content-type": "application/json; charset=utf-8",
      },
      body: JSON.stringify(body),
    });

    await requireSuccessfulChannelSend(response, "Slack");
  }
}
