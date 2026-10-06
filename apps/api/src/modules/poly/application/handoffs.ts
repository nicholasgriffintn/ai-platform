import {
  POLY_HANDOFF_CAPABILITY_ID,
  polyHandoffDataSchema,
  type PolyHandoffData,
  type PolyHandoffDecision,
  type PolyHandoffUrgency,
} from "@ngriffin_uk/polychat-schemas";
import { truncateSingleLine } from "@ngriffin_uk/polychat-utility-core";
import { sha256Hex } from "@ngriffin_uk/polychat-utility-server/crypto";
import { safeParseJson } from "@ngriffin_uk/polychat-utility-server/json";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import type { ActivityRecord } from "~/modules/activity/infrastructure/ActivityRepository";
import { admitPolyNotification } from "~/modules/poly/domain/budgets";
import type { IUser } from "~/types";

import { judgeRoutineResult } from "./handoff-judgement";

const DAY_MS = 24 * 60 * 60 * 1000;
const STORED_SUMMARY_CHARS = 1_600;
const HANDOFFS_PER_DAY_SCAN = 200;

export interface RoutineHandoffInput {
  context: ServiceContext;
  user: IUser;
  polyConversationId: string;
  installationId: string;
  occurrenceId: string;
  phase: "attention" | "result";
  title: string;
  summary: string;
  resultConversationId: string;
  failed: boolean;
}

export interface PolyHandoff {
  id: string;
  title: string;
  createdAt: string;
  data: PolyHandoffData;
}

export function readPolyHandoff(record: ActivityRecord): PolyHandoff | null {
  const data = polyHandoffDataSchema.safeParse(safeParseJson(record.data));

  return data.success
    ? { id: record.id, title: record.summary, createdAt: record.created_at, data: data.data }
    : null;
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
  const activities = input.context.repositories.activities;
  const groupId = `routine:${input.occurrenceId}:${input.phase}`;
  const id = `poly_handoff_${(await sha256Hex(`${input.polyConversationId}:${groupId}`)).slice(0, 40)}`;
  const existing = await activities.getActivityById(id);
  const recorded = existing ? readPolyHandoff(existing) : null;

  if (recorded) {
    return recorded.data.decision;
  }

  const now = Date.now();
  const { urgency, receipt } = await resolveUrgency(input);
  const recent = await activities.listConversationActivitiesSince({
    conversationId: input.polyConversationId,
    capabilityId: POLY_HANDOFF_CAPABILITY_ID,
    since: new Date(now - DAY_MS).toISOString(),
    limit: HANDOFFS_PER_DAY_SCAN,
  });
  const notifiedAt = recent
    .map(readPolyHandoff)
    .filter((handoff) => handoff?.data.decision === "notified")
    .map((handoff) => Date.parse(handoff?.createdAt ?? ""));
  const admission = admitPolyNotification({ urgency, notifiedAt, now });
  const data: PolyHandoffData = {
    sourceKind: "routine",
    sourceId: input.installationId,
    resultConversationId: input.resultConversationId,
    urgency,
    decision: admission.admitted ? "notified" : "noted",
    reason: admission.reason,
    summary: input.summary.slice(0, STORED_SUMMARY_CHARS),
    receipt,
  };
  const stored = await activities.recordActivityOnce({
    id,
    createdByUserId: input.user.id,
    conversationId: input.polyConversationId,
    capabilityId: POLY_HANDOFF_CAPABILITY_ID,
    groupId,
    kind: "routine",
    status: "succeeded",
    summary: truncateSingleLine(input.title, 200),
    data,
    createdAt: new Date(now).toISOString(),
  });

  return readPolyHandoff(stored)?.data.decision ?? data.decision;
}
