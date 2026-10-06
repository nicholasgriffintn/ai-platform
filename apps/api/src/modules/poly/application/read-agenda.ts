import { POLY_TEAMMATE_ID, type PolyAgenda } from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import type { RepositoryManager } from "~/infrastructure/database/repositoryManager";

import { buildPolyAgenda } from "./agenda";

const EMPTY_AGENDA: PolyAgenda = { needs_you: [], working_on: [], done: [] };

export async function loadPolyAgenda(
  repositories: Pick<
    RepositoryManager,
    "teammateContexts" | "delegations" | "goals" | "conversationRuns"
  >,
  userId: number,
): Promise<PolyAgenda> {
  const polyContext = await repositories.teammateContexts.getByIdentity({
    teammateId: POLY_TEAMMATE_ID,
    actorUserId: userId,
    scope: { type: "personal", id: String(userId) },
  });

  if (!polyContext) {
    return EMPTY_AGENDA;
  }

  const conversationId = polyContext.homeConversationId;
  const [delegations, goals, latestRun] = await Promise.all([
    repositories.delegations.listByParentConversationId(conversationId),
    repositories.goals.listGoals({ conversationId }, 1),
    repositories.conversationRuns.getLatestForConversation(conversationId),
  ]);

  return buildPolyAgenda({
    conversationId,
    delegations,
    goal: goals[0] ?? null,
    latestRun,
    now: Date.now(),
  });
}

export function readPolyAgenda(context: ServiceContext): Promise<PolyAgenda> {
  return loadPolyAgenda(context.repositories, context.requireUser().id);
}
