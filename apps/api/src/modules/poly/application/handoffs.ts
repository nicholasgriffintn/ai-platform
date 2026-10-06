import type { PolyHandoffDecision, PolyHandoffUrgency } from "@ngriffin_uk/polychat-schemas";
import { generateId, truncateSingleLine } from "@ngriffin_uk/polychat-utility-core";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { admitPolyNotification } from "~/modules/poly/domain/budgets";
import type { IUser } from "~/types";

import { judgeRoutineResult } from "./handoff-judgement";

const DAY_MS = 24 * 60 * 60 * 1000;
const STORED_SUMMARY_CHARS = 1_600;

export interface RoutineHandoffInput {
  context: ServiceContext;
  user: IUser;
  polyContextId: string;
  installationId: string;
  occurrenceId: string;
  phase: "attention" | "result";
  title: string;
  summary: string;
  resultConversationId: string;
  failed: boolean;
}

async function resolveUrgency(
  input: RoutineHandoffInput,
): Promise<{ urgency: PolyHandoffUrgency; receipt: Record<string, unknown> | null }> {
  if (input.phase === "attention") {
    return { urgency: "critical", receipt: null };
  }

  if (input.failed) {
    return { urgency: "high", receipt: null };
  }

  return judgeRoutineResult({
    env: input.context.env,
    user: input.user,
    occurrenceId: input.occurrenceId,
    title: input.title,
    summary: input.summary,
  });
}

export async function admitRoutineHandoff(
  input: RoutineHandoffInput,
): Promise<PolyHandoffDecision> {
  const handoffs = input.context.repositories.polyHandoffs;
  const fingerprint = `routine:${input.occurrenceId}:${input.phase}`;
  const existing = await handoffs.getByFingerprint(input.polyContextId, fingerprint);

  if (existing) {
    return existing.decision;
  }

  const now = Date.now();
  const { urgency, receipt } = await resolveUrgency(input);
  const notifiedAt = await handoffs.listNotifiedSince(
    input.polyContextId,
    new Date(now - DAY_MS).toISOString(),
  );
  const admission = admitPolyNotification({
    urgency,
    notifiedAt: notifiedAt.map((at) => Date.parse(at)),
    now,
  });
  const recorded = await handoffs.insertOnce({
    id: `poly_handoff_${generateId()}`,
    contextId: input.polyContextId,
    sourceKind: "routine",
    sourceId: input.installationId,
    fingerprint,
    title: truncateSingleLine(input.title, 200),
    summary: input.summary.slice(0, STORED_SUMMARY_CHARS),
    resultConversationId: input.resultConversationId,
    urgency,
    decision: admission.admitted ? "notified" : "noted",
    reason: admission.reason,
    admissionReceipt: receipt,
    createdAt: new Date(now).toISOString(),
  });

  return recorded.decision;
}
