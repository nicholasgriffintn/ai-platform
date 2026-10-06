import { timingSafeEqual } from "@ngriffin_uk/polychat-utility-server/crypto";

import {
  CHANNEL_TOP_LEVEL_THREAD,
  type ChannelAdapter,
  type ChannelIncoming,
  type ChannelReply,
  type ChannelVerification,
} from "~/modules/channels/application/ports/channel-adapter";

import { parseTelegramMessage } from "./channel-payloads";
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
    return parseTelegramMessage(rawBody);
  }

  async sendReply(reply: ChannelReply, secret: string): Promise<void> {
    const response = await fetch(`https://api.telegram.org/bot${secret}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        chat_id: reply.externalId,
        text: reply.body,
        ...(reply.threadId !== CHANNEL_TOP_LEVEL_THREAD
          ? { message_thread_id: Number(reply.threadId) }
          : {}),
      }),
    });

    await requireSuccessfulChannelSend(response, "Telegram");
  }
}
