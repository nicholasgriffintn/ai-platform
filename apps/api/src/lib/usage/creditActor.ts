import type { RepositoryManager } from "~/repositories";

import { ANONYMOUS_PLAN_ID, DEFAULT_USER_PLAN_ID } from "./planSeed";

export type CreditActor =
  | { kind: "user"; userId: number }
  | { kind: "anonymous"; anonymousUserId: string };

export function userCreditActor(userId: number): CreditActor {
  return { kind: "user", userId };
}

export function anonymousCreditActor(anonymousUserId: string): CreditActor {
  return { kind: "anonymous", anonymousUserId };
}

export function creditActorUserId(actor: CreditActor): number | undefined {
  return actor.kind === "user" ? actor.userId : undefined;
}

export function creditActorKey(actor: CreditActor): string {
  return actor.kind === "user" ? `user:${actor.userId}` : `anonymous:${actor.anonymousUserId}`;
}

export interface ActorCreditSpend {
  spentCreditMicros: number;
  reservedCreditMicros: number;
  overrunCreditMicros: number;
  overageCreditMicros: number;
  overageEnabled: boolean;
  lastEventAt: string | null;
}

const NO_SPEND: ActorCreditSpend = {
  spentCreditMicros: 0,
  reservedCreditMicros: 0,
  overrunCreditMicros: 0,
  overageCreditMicros: 0,
  overageEnabled: false,
  lastEventAt: null,
};

export interface ActorCreditDeltas {
  spent_credit_micros?: number;
  reserved_credit_micros?: number;
}

export function defaultActorPlanId(actor: CreditActor, userPlanId?: string | null): string | null {
  return actor.kind === "anonymous" ? ANONYMOUS_PLAN_ID : userPlanId || DEFAULT_USER_PLAN_ID;
}

export async function readActorCreditSpend(
  repositories: RepositoryManager,
  actor: CreditActor,
  period: string,
): Promise<ActorCreditSpend> {
  if (actor.kind === "anonymous") {
    const row = await repositories.anonymousUsers.getCreditSpend(actor.anonymousUserId, period);

    return row ? { ...NO_SPEND, ...row } : NO_SPEND;
  }

  const balance = await repositories.usageBalances.getBalance(actor.userId, period);

  if (!balance) {
    return NO_SPEND;
  }

  return {
    spentCreditMicros: balance.spent_credit_micros ?? 0,
    reservedCreditMicros: balance.reserved_credit_micros ?? 0,
    overrunCreditMicros: balance.overrun_credit_micros ?? 0,
    overageCreditMicros: balance.overage_credit_micros ?? 0,
    overageEnabled: Boolean(balance.overage_enabled),
    lastEventAt: balance.last_event_at ?? null,
  };
}

export interface ApplyActorCreditDeltasParams {
  repositories: RepositoryManager;
  actor: CreditActor;
  period: string;
  deltas: ActorCreditDeltas;
  planId?: string | null;
  includedCreditMicros?: number;
  graceCreditMicros?: number;
}

export async function applyActorCreditDeltas(params: ApplyActorCreditDeltasParams): Promise<void> {
  if (params.actor.kind === "anonymous") {
    await params.repositories.anonymousUsers.applyCreditDeltas(
      params.actor.anonymousUserId,
      params.period,
      params.deltas,
    );

    return;
  }

  await params.repositories.usageBalances.applyDeltas({
    userId: params.actor.userId,
    period: params.period,
    planId: params.planId,
    includedCreditMicros: params.includedCreditMicros,
    graceCreditMicros: params.graceCreditMicros,
    deltas: params.deltas,
  });
}
