export interface ConversationWriteFence {
  assertOwned(): Promise<void>;
}
