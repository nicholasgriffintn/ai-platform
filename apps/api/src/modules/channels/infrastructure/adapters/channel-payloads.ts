import { safeParseJson } from "@ngriffin_uk/polychat-utility-server/json";
import z from "zod/v4";

import {
  CHANNEL_TOP_LEVEL_THREAD,
  type ChannelIncoming,
} from "../../application/ports/channel-adapter";

const slackPayloadSchema = z.object({
  type: z.literal("event_callback"),
  team_id: z.string().regex(/^[A-Z0-9]+$/),
  event: z.object({
    type: z.literal("message"),
    channel: z.string().regex(/^[A-Z0-9]+$/),
    user: z.string().regex(/^[A-Z0-9]+$/),
    text: z.string().min(1).max(40_000),
    ts: z.string().regex(/^\d+\.\d+$/),
    thread_ts: z
      .string()
      .regex(/^\d+\.\d+$/)
      .optional(),
    channel_type: z.enum(["im", "mpim", "channel", "group"]),
    bot_id: z.never().optional(),
    subtype: z.never().optional(),
  }),
});

const slackChallengeSchema = z.object({
  type: z.literal("url_verification"),
  challenge: z.string().min(1).max(2000),
});

const telegramPayloadSchema = z.object({
  message: z.object({
    message_id: z.number().int().positive(),
    message_thread_id: z.number().int().positive().optional(),
    text: z.string().min(1).max(40_000),
    chat: z.object({
      id: z.number().int().safe(),
      type: z.enum(["private", "group", "supergroup", "channel"]),
    }),
    from: z.object({ id: z.number().int().positive().safe(), is_bot: z.literal(false) }),
  }),
});

export function parseSlackMessage(rawBody: string): ChannelIncoming {
  const payload = safeParseJson<unknown>(rawBody);
  const challenge = slackChallengeSchema.safeParse(payload);

  if (challenge.success) {
    return { kind: "control", response: { challenge: challenge.data.challenge } };
  }

  const parsed = slackPayloadSchema.safeParse(payload);

  if (!parsed.success || !parsed.data.event.text.trim()) {
    return { kind: "control", response: { ok: true, ignored: "not_a_user_message" } };
  }

  const { event, team_id: teamId } = parsed.data;

  return {
    kind: "message",
    messageId: event.ts,
    externalId: `${teamId}:${event.channel}`,
    from: `${teamId}:${event.user}`,
    body: event.text,
    context: {
      externalId: `${teamId}:${event.channel}`,
      threadId: event.thread_ts ?? event.ts,
      isDirect: event.channel_type === "im",
    },
  };
}

export function parseTelegramMessage(rawBody: string): ChannelIncoming {
  const parsed = telegramPayloadSchema.safeParse(safeParseJson<unknown>(rawBody));

  if (!parsed.success || !parsed.data.message.text.trim()) {
    return { kind: "control", response: { ok: true, ignored: "not_a_user_message" } };
  }

  const { message } = parsed.data;

  return {
    kind: "message",
    messageId: String(message.message_id),
    externalId: String(message.chat.id),
    from: String(message.from.id),
    body: message.text,
    context: {
      externalId: String(message.chat.id),
      threadId: message.message_thread_id
        ? String(message.message_thread_id)
        : CHANNEL_TOP_LEVEL_THREAD,
      isDirect: message.chat.type === "private",
    },
  };
}
