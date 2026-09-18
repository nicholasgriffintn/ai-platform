import type { InboundChannelId } from "@ngriffin_uk/polychat-schemas";

import type { IEnv } from "~/types";

export interface ChannelSecrets {
  verification?: string;
  reply?: string;
}

export function getChannelSecrets(channel: InboundChannelId, env: IEnv): ChannelSecrets {
  switch (channel) {
    case "slack":
      return { verification: env.SLACK_SIGNING_SECRET, reply: env.SLACK_BOT_TOKEN };
    case "telegram":
      return { verification: env.TELEGRAM_WEBHOOK_SECRET, reply: env.TELEGRAM_BOT_TOKEN };
    case "sms":
    default:
      return {};
  }
}
