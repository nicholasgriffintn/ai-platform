import type { ResponseActivityEvent } from "@ngriffin_uk/polychat-schemas";

import type { ChatEventSink } from "~/modules/chat/application/streaming/emitter";

export type TurnActivity = ResponseActivityEvent;

export function writeTurnActivity(sink: ChatEventSink, activity: TurnActivity): Promise<void> {
  return sink.writeEvent("turn_activity", activity);
}
