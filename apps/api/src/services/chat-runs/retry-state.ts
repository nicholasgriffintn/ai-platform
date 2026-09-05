import type { ChatRetrySnapshot } from "@ngriffin_uk/polychat-schemas";

import type { ChatEventSink } from "~/lib/chat/streaming/emitter";

import type { ChatRunLifecycle } from "./lifecycle";

export function createChatRetryStatePublisher(params: {
  sink: ChatEventSink;
  runLifecycle?: Pick<ChatRunLifecycle, "receipt" | "recordRetry"> | null;
}) {
  return async (retry: ChatRetrySnapshot | null): Promise<void> => {
    const updatedRun = await params.runLifecycle?.recordRetry(retry);

    await params.sink.writeEvent("state", { state: "retry", retry });

    if (updatedRun && params.runLifecycle) {
      await params.sink.writeEvent("state", {
        state: "run",
        receipt: params.runLifecycle.receipt,
      });
    }
  };
}
