import type { ChatTurnActivityEvent } from "@ngriffin_uk/polychat-schemas";

import type { ChatEventSink } from "~/lib/chat/streaming/emitter";

export type TurnActivity = ChatTurnActivityEvent extends infer Event
  ? Event extends { type: "turn_activity" }
    ? Omit<Event, "type">
    : never
  : never;

export function writeTurnActivity(sink: ChatEventSink, activity: TurnActivity): Promise<void> {
  return sink.writeEvent("turn_activity", activity);
}
