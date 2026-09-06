import type { InboundChannelId } from "@ngriffin_uk/polychat-schemas";

import { SlackChannelAdapter } from "./SlackChannelAdapter";
import { TelegramChannelAdapter } from "./TelegramChannelAdapter";
import type { ChannelAdapter } from "./types";

export * from "./types";
export { SlackChannelAdapter } from "./SlackChannelAdapter";
export { TelegramChannelAdapter } from "./TelegramChannelAdapter";

const ADAPTERS: Partial<Record<InboundChannelId, ChannelAdapter>> = {
  slack: new SlackChannelAdapter(),
  telegram: new TelegramChannelAdapter(),
};

export function getChannelAdapter(channel: InboundChannelId): ChannelAdapter | null {
  return ADAPTERS[channel] ?? null;
}

export function listChannelAdapters(): ChannelAdapter[] {
  return Object.values(ADAPTERS).filter((adapter): adapter is ChannelAdapter => Boolean(adapter));
}
