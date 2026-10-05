import { timingSafeEqual } from "@ngriffin_uk/polychat-utility-server/crypto";
import { safeParseJson } from "@ngriffin_uk/polychat-utility-server/json";
import z from "zod/v4";

import type {
  ChannelAdapter,
  ChannelIncoming,
  ChannelReply,
  ChannelVerification,
} from "~/modules/channels/application/ports/channel-adapter";

import { requireSuccessfulChannelSend } from "./send-response";

const TELEGRAM_SECRET_HEADER = "x-telegram-bot-api-secret-token";

/**
 * Telegram does not sign requests. It echoes a secret token chosen when the webhook is
 * registered, so that token is the only thing proving the request came from Telegram.
 */
export class TelegramChannelAdapter implements ChannelAdapter {
  readonly id = "telegram" as const;
  readonly label = "Telegram";
  readonly scopes = ["personal"] as const;

  async verify(request: Request, secret: string, _rawBody: string): Promise<ChannelVerification> {
    const provided = request.headers.get(TELEGRAM_SECRET_HEADER);

    if (!secret) {
      return { ok: false, reason: "No Telegram secret token is configured" };
    }

    if (!provided) {
      return { ok: false, reason: "Telegram request carried no secret token" };
    }

    return timingSafeEqual(secret, provided)
      ? { ok: true }
      : { ok: false, reason: "Telegram secret token did not match" };
  }

  parse(rawBody: string): ChannelIncoming {
    const payload = z
      .object({
        message: z.object({
          message_id: z.number().int().nonnegative(),
          text: z.string().trim().min(1).max(40_000),
          chat: z.object({ id: z.number().int() }),
          from: z.object({ id: z.number().int(), is_bot: z.literal(false).optional() }),
        }),
      })
      .safeParse(safeParseJson<unknown>(rawBody));

    if (!payload.success) {
      return { kind: "control", response: { ok: true, ignored: "not_a_user_message" } };
    }

    const { message } = payload.data;

    return {
      kind: "message",
      messageId: String(message.message_id),
      externalId: String(message.chat.id),
      threadId: String(message.chat.id),
      workspaceId: "",
      mentioned: false,
      directMessage: true,
      from: String(message.from.id),
      body: message.text,
    };
  }

  async sendReply(reply: ChannelReply, secret: string): Promise<void> {
    const response = await fetch(`https://api.telegram.org/bot${secret}/sendMessage`, {
      method: "POST",
      redirect: "error",
      signal: AbortSignal.timeout(10_000),
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: reply.externalId, text: reply.body }),
    });

    await requireSuccessfulChannelSend(response, "Telegram");
  }
}
