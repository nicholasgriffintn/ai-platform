import type { InboundChannelId } from "@ngriffin_uk/polychat-schemas";

export interface InboundChannelProfile {
  id: InboundChannelId;
  label: string;
  conversationPrefix: string;
  tools: string[];
  maxSteps: number;
  historyLimit: number;
}

const SMS_CHANNEL_PROFILE: InboundChannelProfile = {
  id: "sms",
  label: "SMS",
  conversationPrefix: "sms",
  tools: ["trigger_recipe", "get_task_status", "get_weather"],
  maxSteps: 3,
  historyLimit: 8,
};

const SLACK_CHANNEL_PROFILE: InboundChannelProfile = {
  id: "slack",
  label: "Slack",
  conversationPrefix: "slack",
  tools: ["trigger_recipe", "get_task_status", "list_tasks", "find_places"],
  maxSteps: 6,
  historyLimit: 20,
};

const TELEGRAM_CHANNEL_PROFILE: InboundChannelProfile = {
  id: "telegram",
  label: "Telegram",
  conversationPrefix: "telegram",
  tools: ["trigger_recipe", "get_task_status", "get_weather"],
  maxSteps: 4,
  historyLimit: 12,
};

export const INBOUND_CHANNEL_PROFILES: Record<InboundChannelId, InboundChannelProfile> = {
  sms: SMS_CHANNEL_PROFILE,
  slack: SLACK_CHANNEL_PROFILE,
  telegram: TELEGRAM_CHANNEL_PROFILE,
};

export function getInboundChannelProfile(id: InboundChannelId): InboundChannelProfile {
  return INBOUND_CHANNEL_PROFILES[id];
}
