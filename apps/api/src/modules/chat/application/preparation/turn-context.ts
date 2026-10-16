import { buildTurnContext, type PolyAgendaPromptInput } from "@ngriffin_uk/polychat-ai-prompts";
import type { Goal } from "@ngriffin_uk/polychat-schemas";

import type { Repositories } from "~/infrastructure/database/repositories";
import { toPolyAgendaPrompt } from "~/modules/poly/application/agenda";
import { loadPolyAgenda } from "~/modules/poly/application/read-agenda";
import type { PerMessageSkill } from "~/modules/skills/application/per-message";
import type { CoreChatOptions } from "~/types";

export interface LatestTurn {
  text: string;
  context: string;
}

export async function loadPolyAgendaPrompt(
  options: Pick<CoreChatOptions, "poly" | "context">,
  repositories: Repositories,
): Promise<PolyAgendaPromptInput | null> {
  const userId = options.context?.user?.id;

  return options.poly && userId
    ? toPolyAgendaPrompt(await loadPolyAgenda(repositories, userId))
    : null;
}

export function buildLatestTurn({
  text,
  poly,
  agenda,
  activeGoal,
  skills,
}: {
  text: string;
  poly: CoreChatOptions["poly"];
  agenda: PolyAgendaPromptInput | null;
  activeGoal: Goal | null | undefined;
  skills: readonly PerMessageSkill[];
}): LatestTurn {
  return {
    text,
    context: buildTurnContext({
      uiContext: poly?.ui_context,
      agenda,
      goal: activeGoal?.status === "active" ? activeGoal : null,
      skills,
    }),
  };
}
