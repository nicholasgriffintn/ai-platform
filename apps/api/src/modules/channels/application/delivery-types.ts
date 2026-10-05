export interface ChannelReplyPayload {
  body: string;
  mediaUrls: string[];
}

export type ChannelDelivery =
  | { status: "unauthorised_sender" }
  | { status: "channel_unavailable" }
  | {
      status: "ready";
      conversationId: string;
      teammateId?: string;
      projectId?: string;
      bindingId?: string;
      teammateContextId?: string;
      interactionMode: "direct" | "automated";
      validate(): Promise<void>;
      send(reply: ChannelReplyPayload): Promise<void>;
    };
