import type { ProjectTaskStandup, WorkActor } from "@ngriffin_uk/polychat-schemas";

import { sameWorkActor } from "./work-actors";

export function isAwaitingStandupAnswer(standup: ProjectTaskStandup, actor: WorkActor): boolean {
  return (
    !standup.summary &&
    standup.participants.some((participant) => sameWorkActor(participant.actor, actor)) &&
    !standup.answers.some((answer) => sameWorkActor(answer.actor, actor))
  );
}
