import type { InboundChannelId } from "@ngriffin_uk/polychat-schemas";

export interface ChannelIncomingMessage {
  kind: "message";
  messageId: string;
  externalId: string;
  from: string;
  body: string;
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

export interface ChannelReply {
  externalId: string;
  body: string;
}

export interface ChannelAdapter {
  readonly id: InboundChannelId;
  readonly label: string;
  readonly scopes: readonly ("personal" | "project")[];
  verify(request: Request, secret: string, rawBody: string): Promise<ChannelVerification>;
  parse(rawBody: string): ChannelIncoming;
  sendReply(reply: ChannelReply, secret: string): Promise<void>;
}
