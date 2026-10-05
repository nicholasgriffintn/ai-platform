import type { ChannelIncomingMessage, InboundChannelId } from "@ngriffin_uk/polychat-schemas";

export type { ChannelIncomingMessage } from "@ngriffin_uk/polychat-schemas";

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
  threadId: string;
}

export interface ChannelAdapter {
  readonly id: InboundChannelId;
  readonly label: string;
  readonly scopes: readonly ("personal" | "project")[];
  verify(request: Request, secret: string, rawBody: string): Promise<ChannelVerification>;
  parse(rawBody: string, options?: { botUserId?: string }): ChannelIncoming;
  sendReply(reply: ChannelReply, secret: string): Promise<void>;
}
