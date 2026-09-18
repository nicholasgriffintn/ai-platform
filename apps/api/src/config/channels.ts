import type { InboundChannelId } from "@ngriffin_uk/polychat-schemas";

import type { IEnv } from "~/types";

export interface ChannelSecretEnvKeys {
  verification?: keyof IEnv;
  reply?: keyof IEnv;
}

/** Which environment variables hold each inbound channel's verification and reply secrets. */
export const CHANNEL_SECRET_ENV_KEYS: Partial<Record<InboundChannelId, ChannelSecretEnvKeys>> = {
  slack: { verification: "SLACK_SIGNING_SECRET", reply: "SLACK_BOT_TOKEN" },
  telegram: { verification: "TELEGRAM_WEBHOOK_SECRET", reply: "TELEGRAM_BOT_TOKEN" },
  sms: {},
};
