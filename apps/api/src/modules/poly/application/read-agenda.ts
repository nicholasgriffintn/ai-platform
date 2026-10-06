import { POLY_TEAMMATE_ID, type PolyAgenda } from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import type { RepositoryManager } from "~/infrastructure/database/repositoryManager";

import { buildPolyAgenda } from "./agenda";

const EMPTY_AGENDA: PolyAgenda = { needs_you: [], working_on: [], done: [], noted: [] };
const NOTED_HORIZON_MS = 7 * 24 * 60 * 60 * 1000;
const NOTED_LIMIT = 8;

export async function loadPolyAgenda(
  repositories: Pick<
    RepositoryManager,
    "teammateContexts" | "delegations" | "goals" | "conversationRuns" | "polyHandoffs"
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

  const now = Date.now();
  const conversationId = polyContext.homeConversationId;
  const [delegations, goals, latestRun, noted] = await Promise.all([
    repositories.delegations.listByParentConversationId(conversationId),
    repositories.goals.listGoals({ conversationId }, 1),
    repositories.conversationRuns.getLatestForConversation(conversationId),
    repositories.polyHandoffs.listNotedSince(
      polyContext.id,
      new Date(now - NOTED_HORIZON_MS).toISOString(),
      NOTED_LIMIT,
    ),
  ]);

  return buildPolyAgenda({
    conversationId,
    delegations,
    goal: goals[0] ?? null,
    latestRun,
    noted: noted.map((handoff) => ({
      id: handoff.id,
      title: handoff.title,
      reason: handoff.reason,
      resultConversationId: handoff.result_conversation_id,
      createdAt: handoff.created_at,
    })),
    now,
  });
}

export function readPolyAgenda(context: ServiceContext): Promise<PolyAgenda> {
  return loadPolyAgenda(context.repositories, context.requireUser().id);
}
