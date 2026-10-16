import { responseReceiptEvent, type ChatContextSnapshot } from "@ngriffin_uk/polychat-schemas";

import type { ChatEventSink } from "~/modules/responses/application/engine/streaming/emitter";

import type { ChatRunLifecycle } from "./lifecycle";

export function createChatContextPublisher(params: {
  sink: ChatEventSink;
  runLifecycle?: Pick<ChatRunLifecycle, "receipt" | "recordContext"> | null;
}) {
  const { runLifecycle } = params;

  if (!runLifecycle) {
    return undefined;
  }

  return async (snapshot: ChatContextSnapshot): Promise<void> => {
    await runLifecycle.recordContext(snapshot);
    await params.sink.write(responseReceiptEvent(runLifecycle.receipt));
  };
}
