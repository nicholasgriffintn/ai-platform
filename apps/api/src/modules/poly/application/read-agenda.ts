import {
  POLY_HANDOFF_CAPABILITY_ID,
  POLY_TEAMMATE_ID,
  type PolyAgenda,
  type PolyAgendaView,
  type TeammateContext,
} from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import type { RepositoryManager } from "~/infrastructure/database/repositoryManager";
import { handoffOverrideRef, readHandoffJudgement } from "~/modules/poly/domain/handoff-overrides";

import { buildPolyAgenda } from "./agenda";
import { readPolyHandoff } from "./handoffs";
import { markPolyOwnerSeen, requirePolyContext, toPolyHome } from "./home";

const EMPTY_AGENDA: PolyAgenda = { needs_you: [], working_on: [], done: [], noted: [] };
const NOTED_HORIZON_MS = 7 * 24 * 60 * 60 * 1000;
const NOTED_SCAN_LIMIT = 50;

type AgendaRepositories = Pick<
  RepositoryManager,
  "teammateContexts" | "delegations" | "goals" | "conversationRuns" | "activities" | "corrections"
>;

function findPolyContext(
  repositories: Pick<RepositoryManager, "teammateContexts">,
  userId: number,
): Promise<TeammateContext | null> {
  return repositories.teammateContexts.getByIdentity({
    teammateId: POLY_TEAMMATE_ID,
    actorUserId: userId,
    scope: { type: "personal", id: String(userId) },
  });
}

export async function loadPolyAgenda(
  repositories: AgendaRepositories,
  userId: number,
): Promise<PolyAgenda> {
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
): Promise<PolyAgenda> {
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

export async function readPolyAgenda(
  context: ServiceContext,
  options: { ownerPresent?: boolean } = {},
): Promise<PolyAgendaView> {
  const userId = context.requireUser().id;
  const polyContext = options.ownerPresent
    ? await requirePolyContext(context)
    : await findPolyContext(context.repositories, userId);

  if (polyContext && options.ownerPresent) {
    await markPolyOwnerSeen(context, polyContext);
  }

  return {
    ...(await loadPolyAgendaForContext(context.repositories, userId, polyContext)),
    home: polyContext ? toPolyHome(polyContext) : null,
  };
}
