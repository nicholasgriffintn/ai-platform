import type { ResponseActivityEvent } from "@ngriffin_uk/polychat-schemas";

import type { ChatEventSink } from "~/modules/responses/application/engine/streaming/emitter";

export type TurnActivity = ResponseActivityEvent;

export function writeTurnActivity(sink: ChatEventSink, activity: TurnActivity): Promise<void> {
  return sink.write({ type: "response.activity", ...activity });
}
