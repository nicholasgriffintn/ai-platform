import type { InboundChannelId } from "@ngriffin_uk/polychat-schemas";

import type { ChannelAdapter } from "~/modules/channels/application/ports/channel-adapter";

import { SlackChannelAdapter } from "./SlackChannelAdapter";
import { TelegramChannelAdapter } from "./TelegramChannelAdapter";

export * from "./SlackChannelAdapter";
export * from "./TelegramChannelAdapter";

const ADAPTERS: Partial<Record<InboundChannelId, ChannelAdapter>> = {
  slack: new SlackChannelAdapter(),
  telegram: new TelegramChannelAdapter(),
};

export function getChannelAdapter(channel: InboundChannelId): ChannelAdapter | null {
  return ADAPTERS[channel] ?? null;
}
