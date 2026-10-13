export interface BatchCompletionItem {
  id: string;
  model: string;
  prompt: string;
  system?: string;
  maxTokens: number;
}

export interface BatchCompletionResult {
  id: string;
  text?: string;
  error?: string;
}

export type BatchPoll =
  | { status: "in_progress" }
  | { status: "completed"; results: BatchCompletionResult[] }
  | { status: "failed"; reason: string };

export interface BatchProvider {
  name: string;
  submit(items: readonly BatchCompletionItem[]): Promise<{ batchId: string }>;
  poll(batchId: string): Promise<BatchPoll>;
}

export type BatchRequestInit = Omit<RequestInit, "headers"> & {
  headers?: Record<string, string>;
};
