import type { InboundChannelId } from "@ngriffin_uk/polychat-schemas";

import type {
  ChannelAdapter,
  WebhookChannelAdapter,
} from "~/modules/channels/application/ports/channel-adapter";

import { EmailChannelAdapter } from "./EmailChannelAdapter";
import { SlackChannelAdapter } from "./SlackChannelAdapter";
import { TelegramChannelAdapter } from "./TelegramChannelAdapter";

export * from "./EmailChannelAdapter";
export * from "./SlackChannelAdapter";
export * from "./TelegramChannelAdapter";

const WEBHOOK_ADAPTERS: Partial<Record<InboundChannelId, WebhookChannelAdapter>> = {
  slack: new SlackChannelAdapter(),
  telegram: new TelegramChannelAdapter(),
};

const ADAPTERS: Partial<Record<InboundChannelId, ChannelAdapter>> = {
  ...WEBHOOK_ADAPTERS,
  email: new EmailChannelAdapter(),
};

export function getChannelAdapter(channel: InboundChannelId): ChannelAdapter | null {
  return ADAPTERS[channel] ?? null;
}

export function getWebhookChannelAdapter(channel: InboundChannelId): WebhookChannelAdapter | null {
  return WEBHOOK_ADAPTERS[channel] ?? null;
}
