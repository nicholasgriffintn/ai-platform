import { safeParseJson } from "@ngriffin_uk/polychat-utility-server/json";
import z from "zod/v4";

import type { ChannelIncoming } from "~/modules/channels/application/ports/channel-adapter";

const slackEventSchema = z.object({
  team_id: z.string().regex(/^T[A-Z0-9]+$/),
  event: z.object({
    type: z.enum(["message", "app_mention"]),
    channel: z.string().regex(/^[CDG][A-Z0-9]+$/),
    user: z.string().regex(/^[UW][A-Z0-9]+$/),
    text: z.string().trim().min(1).max(40_000),
    ts: z.string().regex(/^\d{1,12}\.\d{1,6}$/),
    thread_ts: z
      .string()
      .regex(/^\d{1,12}\.\d{1,6}$/)
      .optional(),
    channel_type: z.enum(["im", "mpim", "channel", "group"]).optional(),
    bot_id: z.never().optional(),
    subtype: z.never().optional(),
  }),
});

const slackChallengeSchema = z.object({
  type: z.literal("url_verification"),
  challenge: z.string().min(1).max(1_000),
});

export function parseSlackEvent(rawBody: string, botUserId?: string): ChannelIncoming {
  const payload = safeParseJson<unknown>(rawBody);
  const challenge = slackChallengeSchema.safeParse(payload);

  if (challenge.success) {
    return { kind: "control", response: { challenge: challenge.data.challenge } };
  }

  const parsed = slackEventSchema.safeParse(payload);

  if (!parsed.success) {
    return { kind: "control", response: { ok: true, ignored: "not_a_user_message" } };
  }

  const { event, team_id } = parsed.data;
  const botMention = botUserId ? `<@${botUserId}>` : null;
  const mentioned =
    event.type === "app_mention" || (botMention !== null && event.text.includes(botMention));
  const body = botMention ? event.text.split(botMention).join("").trim() : event.text;

  if (!body || event.user === botUserId) {
    return { kind: "control", response: { ok: true, ignored: "empty_or_own_message" } };
  }

  return {
    kind: "message",
    messageId: event.ts,
    workspaceId: team_id,
    externalId: event.channel,
    threadId: event.thread_ts ?? event.ts,
    from: event.user,
    body,
    mentioned,
    directMessage: event.channel_type === "im",
  };
}
