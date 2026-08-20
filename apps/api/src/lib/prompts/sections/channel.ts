import { getInboundChannelProfile } from "~/lib/chat/channels";
import type { ChatRequestOptions } from "~/types";
import { escapeHtml } from "~/utils/html";

export function buildChannelSection(channel: ChatRequestOptions["channel"]): string {
  if (!channel) {
    return "";
  }

  const profile = getInboundChannelProfile(channel.id);
  const lines = [
    "<channel_context>",
    `<channel>${escapeHtml(profile.label)}</channel>`,
    `<sender>${channel.from ? escapeHtml(channel.from) : "unavailable"}</sender>`,
    `<recipient>${channel.to ? escapeHtml(channel.to) : "unavailable"}</recipient>`,
    "<constraints>",
    ...profile.constraints.map((constraint) => `- ${constraint}`),
    "</constraints>",
    "</channel_context>",
    "",
  ];

  return `${lines.join("\n")}\n`;
}
