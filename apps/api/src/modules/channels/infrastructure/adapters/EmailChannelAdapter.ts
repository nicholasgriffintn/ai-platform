import { emailChannelAddressSchema } from "@ngriffin_uk/polychat-schemas";
import { replySubject } from "@ngriffin_uk/polychat-utility-server/email-text";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import {
  CHANNEL_TOP_LEVEL_THREAD,
  type ChannelAdapter,
  type ChannelReply,
} from "~/modules/channels/application/ports/channel-adapter";
import type { IEnv } from "~/types";

const SENDER_NAME = "Polychat";
const FALLBACK_SUBJECT = "A word from the perch";

function threadingHeaders(reply: ChannelReply): Record<string, string> {
  if (!reply.inReplyTo) {
    return {};
  }

  const references =
    reply.threadId !== CHANNEL_TOP_LEVEL_THREAD && reply.threadId !== reply.inReplyTo
      ? `${reply.threadId} ${reply.inReplyTo}`
      : reply.inReplyTo;

  return { "In-Reply-To": reply.inReplyTo, References: references };
}

export class EmailChannelAdapter implements ChannelAdapter {
  readonly id = "email" as const;
  readonly label = "Email";
  readonly scopes = ["personal"] as const;

  isReplyConfigured(env: IEnv): boolean {
    return Boolean(env.SEND_EMAIL && env.SES_EMAIL_FROM && env.EMAIL_INBOUND_ADDRESS);
  }

  async sendReply(reply: ChannelReply, env: IEnv): Promise<void> {
    const { SEND_EMAIL, SES_EMAIL_FROM, EMAIL_INBOUND_ADDRESS } = env;

    if (!SEND_EMAIL || !SES_EMAIL_FROM || !EMAIL_INBOUND_ADDRESS) {
      throw new AssistantError(
        "Email has no reply address configured",
        ErrorType.CONFIGURATION_ERROR,
      );
    }

    if (!emailChannelAddressSchema.safeParse(reply.externalId).success) {
      throw new AssistantError("Invalid email destination", ErrorType.PARAMS_ERROR, 400);
    }

    await SEND_EMAIL.send({
      from: { name: SENDER_NAME, email: SES_EMAIL_FROM },
      to: reply.externalId,
      replyTo: EMAIL_INBOUND_ADDRESS,
      subject: replySubject(reply.subject, FALLBACK_SUBJECT),
      text: reply.body,
      headers: { ...threadingHeaders(reply), "Auto-Submitted": "auto-replied" },
    });
  }
}
