import {
  responseLifecycleEvent,
  toResponse,
  type ChatRetrySnapshot,
} from "@ngriffin_uk/polychat-schemas";

import type { ChatEventSink } from "~/modules/responses/application/engine/streaming/emitter";

import type { ChatRunLifecycle } from "./lifecycle";

export function createChatRetryStatePublisher(params: {
  sink: ChatEventSink;
  runLifecycle?: Pick<ChatRunLifecycle, "receipt" | "recordRetry"> | null;
}) {
  return async (retry: ChatRetrySnapshot | null): Promise<void> => {
    const updatedRun = await params.runLifecycle?.recordRetry(retry);

    await params.sink.write({ type: "response.retry", retry });

    if (updatedRun && params.runLifecycle) {
      const { receipt } = params.runLifecycle;

      await params.sink.write(responseLifecycleEvent(toResponse(receipt.run, { receipt })));
    }
  };
}
