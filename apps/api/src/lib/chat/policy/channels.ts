import type { InboundChannelId } from "@ngriffin_uk/polychat-schemas";

export interface InboundChannelProfile {
  id: InboundChannelId;
  label: string;
  conversationPrefix: string;
  tools: string[];
  maxSteps: number;
  historyLimit: number;
  constraints: string[];
}

const SMS_CHANNEL_PROFILE: InboundChannelProfile = {
  id: "sms",
  label: "SMS",
  conversationPrefix: "sms",
  tools: ["trigger_recipe", "get_task_status", "get_weather"],
  maxSteps: 3,
  historyLimit: 8,
  constraints: [
    "Input length is limited and replies may be split or truncated by carriers.",
    "Keep replies concise and plain-text, with no markdown tables.",
    "The user cannot see tool output, intermediate steps, or cancel work in flight.",
    "Prefer one clear next action when setup, confirmation, or clarification is needed.",
  ],
};

const SLACK_CHANNEL_PROFILE: InboundChannelProfile = {
  id: "slack",
  label: "Slack",
  conversationPrefix: "slack",
  tools: ["trigger_recipe", "get_task_status", "list_tasks", "find_places"],
  maxSteps: 6,
  historyLimit: 20,
  constraints: [
    "Replies land in a shared channel, so assume other people are reading.",
    "Keep replies short and use Slack's plain formatting, not markdown tables.",
    "The user cannot see tool output or cancel work in flight from here.",
    "Never repeat credentials, tokens or private conversation content into the channel.",
  ],
};

const TELEGRAM_CHANNEL_PROFILE: InboundChannelProfile = {
  id: "telegram",
  label: "Telegram",
  conversationPrefix: "telegram",
  tools: ["trigger_recipe", "get_task_status", "get_weather"],
  maxSteps: 4,
  historyLimit: 12,
  constraints: [
    "Replies are plain text in a private chat; keep them short.",
    "The user cannot see tool output, intermediate steps, or cancel work in flight.",
    "Prefer one clear next action when setup or confirmation is needed.",
  ],
};

export const INBOUND_CHANNEL_PROFILES: Record<InboundChannelId, InboundChannelProfile> = {
  sms: SMS_CHANNEL_PROFILE,
  slack: SLACK_CHANNEL_PROFILE,
  telegram: TELEGRAM_CHANNEL_PROFILE,
};

export function getInboundChannelProfile(id: InboundChannelId): InboundChannelProfile {
  return INBOUND_CHANNEL_PROFILES[id];
}
