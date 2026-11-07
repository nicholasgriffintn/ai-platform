import { AsyncLocalStorage } from "node:async_hooks";

import {
  createRequestCache,
  memoizeRequest,
  type RequestCache,
} from "@ngriffin_uk/polychat-utility-server/request-cache";

interface ConversationReadWindow {
  reads: RequestCache | undefined;
}

const readWindows = new AsyncLocalStorage<ConversationReadWindow>();

export async function withConversationReadWindow<T>(run: () => Promise<T>): Promise<T> {
  const window: ConversationReadWindow = { reads: createRequestCache() };

  try {
    return await readWindows.run(window, run);
  } finally {
    window.reads = undefined;
  }
}

export function readConversationOnce<T>(
  conversationId: string,
  load: () => Promise<T>,
): Promise<T> {
  return memoizeRequest(readWindows.getStore()?.reads, conversationId, load);
}

export function forgetConversationReads(): void {
  readWindows.getStore()?.reads?.clear();
}
