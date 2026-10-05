import {
  inboundChannelMessageSchema,
  inboundChannelTaskSchema,
  type InboundChannelTaskData,
  type InboundBindingTaskData,
  type InboundChannelMessage,
  type ChannelIncomingMessage,
} from "@ngriffin_uk/polychat-schemas";

import type { IncomingMessage } from "~/infrastructure/providers/capabilities/messaging";

export function isInboundBindingTaskData(
  data: InboundChannelTaskData,
): data is InboundBindingTaskData {
  return "bindingId" in data;
}

export function parseInboundChannelTaskData(value: unknown): InboundChannelTaskData | null {
  const result = inboundChannelTaskSchema.safeParse(value);

  return result.success ? result.data : null;
}

export function toChannelBindingMessage(incoming: ChannelIncomingMessage): InboundChannelMessage {
  return inboundChannelMessageSchema.parse(incoming);
}

export function toInboundChannelMessage(incoming: IncomingMessage): InboundChannelMessage {
  return inboundChannelMessageSchema.parse(incoming);
}
