import {
  POLY_HANDOFF_CAPABILITY_ID,
  POLY_TEAMMATE_ID,
  type PolyAgenda,
} from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import type { RepositoryManager } from "~/infrastructure/database/repositoryManager";
import { handoffOverrideRef, readHandoffJudgement } from "~/modules/poly/domain/handoff-overrides";

import { buildPolyAgenda } from "./agenda";
import { readPolyHandoff } from "./handoffs";

const EMPTY_AGENDA: PolyAgenda = { needs_you: [], working_on: [], done: [], noted: [] };
const NOTED_HORIZON_MS = 7 * 24 * 60 * 60 * 1000;
const NOTED_SCAN_LIMIT = 50;

export async function loadPolyAgenda(
  repositories: Pick<
    RepositoryManager,
    "teammateContexts" | "delegations" | "goals" | "conversationRuns" | "activities" | "corrections"
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
  const [delegations, goals, latestRun, handoffs] = await Promise.all([
    repositories.delegations.listByParentConversationId(conversationId),
    repositories.goals.listGoals({ conversationId }, 1),
    repositories.conversationRuns.getLatestForConversation(conversationId),
    repositories.activities.listConversationActivitiesSince({
      conversationId,
      capabilityId: POLY_HANDOFF_CAPABILITY_ID,
      since: new Date(now - NOTED_HORIZON_MS).toISOString(),
      limit: NOTED_SCAN_LIMIT,
    }),
  ]);

  const notedHandoffs = handoffs.flatMap((record) => {
    const handoff = readPolyHandoff(record);

    return handoff?.data.decision === "noted" ? [handoff] : [];
  });
  const overrides = await repositories.corrections.listActiveByPlacementRefs(userId, [
    ...new Set(notedHandoffs.map((handoff) => handoffOverrideRef(handoff.data.sourceId))),
  ]);
  const overruled = new Set(overrides.map((override) => override.placementRef));

  return buildPolyAgenda({
    conversationId,
    delegations,
    goal: goals[0] ?? null,
    latestRun,
    noted: notedHandoffs
      .filter((handoff) => !overruled.has(handoffOverrideRef(handoff.data.sourceId)))
      .map((handoff) => ({
        id: handoff.id,
        title: handoff.title,
        reason: handoff.data.reason,
        resultConversationId: handoff.data.resultConversationId,
        createdAt: handoff.createdAt,
        judgement: readHandoffJudgement(handoff.data.receipt),
      })),
    now,
  });
}

export function readPolyAgenda(context: ServiceContext): Promise<PolyAgenda> {
  return loadPolyAgenda(context.repositories, context.requireUser().id);
}
