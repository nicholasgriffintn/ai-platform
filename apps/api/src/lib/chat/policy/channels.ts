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

export const INBOUND_CHANNEL_PROFILES: Record<InboundChannelId, InboundChannelProfile> = {
  sms: SMS_CHANNEL_PROFILE,
};

export function getInboundChannelProfile(id: InboundChannelId): InboundChannelProfile {
  return INBOUND_CHANNEL_PROFILES[id];
}
