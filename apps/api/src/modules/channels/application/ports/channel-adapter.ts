import type { ChannelMessageContext, InboundChannelId } from "@ngriffin_uk/polychat-schemas";

import type { IEnv } from "~/types";

export interface ChannelIncomingMessage {
  kind: "message";
  messageId: string;
  externalId: string;
  from: string;
  body: string;
  context: ChannelMessageContext;
  media?: { url: string; mimeType?: string }[];
}

export interface ChannelControlResponse {
  kind: "control";
  response: Record<string, unknown>;
}

export type ChannelIncoming = ChannelIncomingMessage | ChannelControlResponse;

export interface ChannelVerification {
  ok: boolean;
  reason?: string;
}

export const CHANNEL_TOP_LEVEL_THREAD = "direct";

export interface ChannelReply {
  externalId: string;
  body: string;
  threadId: string;
  inReplyTo?: string;
  subject?: string;
}

export interface ChannelAdapter {
  readonly id: InboundChannelId;
  readonly label: string;
  readonly scopes: readonly ("personal" | "project")[];
  isReplyConfigured(env: IEnv): boolean;
  sendReply(reply: ChannelReply, env: IEnv): Promise<void>;
}

export interface WebhookChannelAdapter extends ChannelAdapter {
  verify(request: Request, secret: string, rawBody: string): Promise<ChannelVerification>;
  parse(rawBody: string): ChannelIncoming;
}
