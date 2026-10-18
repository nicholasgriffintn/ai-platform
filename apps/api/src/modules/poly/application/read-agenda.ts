import {
  POLY_HANDOFF_CAPABILITY_ID,
  POLY_TEAMMATE_ID,
  type PolyAgenda,
  type PolyAgendaLists,
  type TeammateContext,
} from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import type { Repositories } from "~/infrastructure/database/repositories";
import { ActivityRepository } from "~/modules/activity/infrastructure/ActivityRepository";
import { ConversationRunRepository } from "~/modules/conversations/infrastructure/ConversationRunRepository";
import { CorrectionRepository } from "~/modules/corrections/infrastructure/CorrectionRepository";
import { DelegationRepository } from "~/modules/delegations/infrastructure/DelegationRepository";
import { GoalRepository } from "~/modules/goals/infrastructure/GoalRepository";
import { handoffOverrideRef, readHandoffJudgement } from "~/modules/poly/domain/handoff-overrides";
import { TeammateContextRepository } from "~/modules/teammates/infrastructure/TeammateContextRepository";

import { buildPolyAgenda } from "./agenda";
import { readPolyHandoff } from "./handoffs";
import { readPolyLookAround } from "./look-around";
import { describePolyContext, markPolyOwnerSeen, requirePolyContext } from "./poly-context";

const EMPTY_AGENDA: PolyAgendaLists = { needs_you: [], working_on: [], done: [], noted: [] };
const NOTED_HORIZON_MS = 7 * 24 * 60 * 60 * 1000;
const NOTED_SCAN_LIMIT = 50;

type AgendaRepositories = Repositories;

function findPolyContext(
  repositories: Repositories,
  userId: number,
): Promise<TeammateContext | null> {
  return repositories.get(TeammateContextRepository).getByIdentity({
    teammateId: POLY_TEAMMATE_ID,
    actorUserId: userId,
    scope: { type: "personal", id: String(userId) },
  });
}

export async function loadPolyAgenda(
  repositories: AgendaRepositories,
  userId: number,
): Promise<PolyAgendaLists> {
  return loadPolyAgendaForContext(
    repositories,
    userId,
    await findPolyContext(repositories, userId),
  );
}

async function loadPolyAgendaForContext(
  repositories: AgendaRepositories,
  userId: number,
  polyContext: TeammateContext | null,
): Promise<PolyAgendaLists> {
  if (!polyContext) {
    return EMPTY_AGENDA;
  }

  const now = Date.now();
  const conversationId = polyContext.homeConversationId;
  const [delegations, goals, latestRun, handoffs] = await Promise.all([
    repositories.get(DelegationRepository).listByParentConversationId(conversationId),
    repositories.get(GoalRepository).listGoals({ conversationId }, 1),
    repositories.get(ConversationRunRepository).getLatestForConversation(conversationId),
    repositories.get(ActivityRepository).listConversationActivitiesSince({
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
  const overrides = await repositories
    .get(CorrectionRepository)
    .listActiveByPlacementRefs(userId, [
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
        sourceKind: handoff.data.sourceKind,
        resultConversationId: handoff.data.resultConversationId,
        createdAt: handoff.createdAt,
        judgement: readHandoffJudgement(handoff.data.receipt),
      })),
    now,
  });
}

export async function readPolyAgenda(context: ServiceContext): Promise<PolyAgenda> {
  const polyContext = await requirePolyContext(context);

  await markPolyOwnerSeen(context, polyContext);

  return {
    ...describePolyContext(polyContext),
    look_around: await readPolyLookAround(context, polyContext),
    ...(await loadPolyAgendaForContext(
      context.repositories,
      context.requireUser().id,
      polyContext,
    )),
  };
}
