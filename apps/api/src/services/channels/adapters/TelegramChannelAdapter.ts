import { safeParseJson } from "~/utils/json";

import { requireSuccessfulChannelSend } from "./send-response";
import type { ChannelAdapter, ChannelIncoming, ChannelReply, ChannelVerification } from "./types";

const TELEGRAM_SECRET_HEADER = "x-telegram-bot-api-secret-token";

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
    const payload = safeParseJson<Record<string, unknown>>(rawBody) ?? {};
    const message = payload.message ?? payload.edited_message;

    if (!message || typeof message !== "object") {
      return { kind: "control", response: { ok: true, ignored: "not_a_message" } };
    }

    const typed = message as {
      message_id?: number;
      text?: string;
      chat?: { id?: number };
      from?: { id?: number; is_bot?: boolean };
    };

    if (typed.from?.is_bot) {
      return { kind: "control", response: { ok: true, ignored: "bot_message" } };
    }

    if (!typed.chat?.id || typed.message_id === undefined || !typed.text?.trim()) {
      return { kind: "control", response: { ok: true, ignored: "incomplete_message" } };
    }

    return {
      kind: "message",
      messageId: String(typed.message_id),
      externalId: String(typed.chat.id),
      from: String(typed.from?.id ?? typed.chat.id),
      body: typed.text,
    };
  }

  async sendReply(reply: ChannelReply, secret: string): Promise<void> {
    const response = await fetch(`https://api.telegram.org/bot${secret}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: reply.externalId, text: reply.body }),
    });

    await requireSuccessfulChannelSend(response, "Telegram");
  }
}
