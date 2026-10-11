import {
  TEAMMATE_OWNER_ABSENCE_DAYS,
  TEAMMATE_STANDING_OFFER_STREAK,
  type TeammateApprovalStreak,
  type TeammateAutonomyLevel,
  type TeammateStandingApproval,
} from "@ngriffin_uk/polychat-schemas";

const DAY_MS = 24 * 60 * 60 * 1000;
const STREAK_WINDOW_MS = 14 * DAY_MS;
const MAX_TRACKED_STREAKS = 50;

export type ApprovalOutcome = "approved" | "rejected";

function sameCall(
  streak: TeammateApprovalStreak,
  call: { toolName: string; destination: string },
): boolean {
  return streak.toolName === call.toolName && streak.destination === call.destination;
}

function isFresh(streak: TeammateApprovalStreak, now: number): boolean {
  return now - Date.parse(streak.lastApprovedAt) < STREAK_WINDOW_MS;
}

export function recordApprovalOutcome(params: {
  streaks: readonly TeammateApprovalStreak[];
  toolName: string;
  destination: string;
  interactionId: string;
  outcome: ApprovalOutcome;
  now: number;
}): TeammateApprovalStreak[] {
  const current = params.streaks.find((streak) => sameCall(streak, params));

  if (current?.lastInteractionId === params.interactionId) {
    return [...params.streaks];
  }

  const others = params.streaks.filter(
    (streak) => !sameCall(streak, params) && isFresh(streak, params.now),
  );

  if (params.outcome === "rejected") {
    return others;
  }

  const approvals = current && isFresh(current, params.now) ? current.approvals + 1 : 1;

  return [
    {
      toolName: params.toolName,
      destination: params.destination,
      approvals,
      lastInteractionId: params.interactionId,
      lastApprovedAt: new Date(params.now).toISOString(),
    },
    ...others,
  ].slice(0, MAX_TRACKED_STREAKS);
}

export function approvalsInARow(params: {
  streaks: readonly TeammateApprovalStreak[] | undefined;
  toolName: string;
  destination: string | undefined;
  now: number;
}): number {
  const { destination } = params;

  if (!destination) {
    return 0;
  }

  const streak = (params.streaks ?? []).find((candidate) =>
    sameCall(candidate, { toolName: params.toolName, destination }),
  );

  return streak && isFresh(streak, params.now) ? streak.approvals : 0;
}

export function hasEarnedStandingOffer(approvedInARow: number): boolean {
  return approvedInARow >= TEAMMATE_STANDING_OFFER_STREAK;
}

export function isOwnerAbsent(ownerSeenAt: string, now: number): boolean {
  const seen = Date.parse(ownerSeenAt);

  return Number.isNaN(seen) || now - seen >= TEAMMATE_OWNER_ABSENCE_DAYS * DAY_MS;
}

export function applyOwnerAbsenceBrake(params: {
  autonomyLevel: TeammateAutonomyLevel | null;
  standingApprovals: readonly TeammateStandingApproval[];
  ownerSeenAt: string;
  ownerStartedRun: boolean;
  now: number;
}): {
  autonomyLevel: TeammateAutonomyLevel | null;
  standingApprovals: TeammateStandingApproval[];
  braked: boolean;
} {
  if (
    params.ownerStartedRun ||
    params.autonomyLevel === null ||
    !isOwnerAbsent(params.ownerSeenAt, params.now)
  ) {
    return {
      autonomyLevel: params.autonomyLevel,
      standingApprovals: [...params.standingApprovals],
      braked: false,
    };
  }

  return {
    autonomyLevel: params.autonomyLevel === "partner" ? "assistant" : params.autonomyLevel,
    standingApprovals: [],
    braked: true,
  };
}
