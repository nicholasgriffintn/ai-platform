import type { InboundChannelId } from "@ngriffin_uk/polychat-schemas";

import { CHANNEL_SECRET_ENV_KEYS } from "~/config/channels";
import type { IEnv } from "~/types";

export interface ChannelSecrets {
  verification?: string;
  reply?: string;
}

export function getChannelSecrets(channel: InboundChannelId, env: IEnv): ChannelSecrets {
  const keys = CHANNEL_SECRET_ENV_KEYS[channel] ?? {};

  return {
    verification: keys.verification ? (env[keys.verification] as string | undefined) : undefined,
    reply: keys.reply ? (env[keys.reply] as string | undefined) : undefined,
  };
}
