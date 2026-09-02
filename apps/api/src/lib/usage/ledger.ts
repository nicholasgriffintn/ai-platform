import {
  creditMicrosFromCostMicros,
  DEFAULT_MARGIN,
  priceUsage,
  usagePeriodFromDate,
  USAGE_ROLLUP_TASK_TYPE,
  type RateEntry,
  type UsageSource,
  type UsageUnit,
} from "@ngriffin_uk/polychat-schemas";

import type { RepositoryManager } from "~/repositories";
import type { UsageEventInsert } from "~/repositories/UsageEventRepository";
import { TaskService } from "~/services/tasks/TaskService";
import type { IEnv } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { generateId } from "~/utils/id";
import { getLogger } from "~/utils/logger";

import { applyActorCreditDeltas, creditActorUserId, type CreditActor } from "./creditActor";
import { resolveUsagePlanSeed, type UsagePlanSeed } from "./planSeed";

const logger = getLogger({ prefix: "lib/usage/ledger" });

const BYOK_EXEMPT_SOURCES: ReadonlySet<UsageSource> = new Set<UsageSource>([
  "model",
  "hosted_tool",
]);

export interface UsageEventDraft {
  idempotencyKey: string;
  actor: CreditActor;
  source: UsageSource;
  vendor: string;
  resource: string;
  unit: UsageUnit;
  quantity: number;
  occurredAt?: string;
  workspaceId?: string | null;
  projectId?: string | null;
  conversationId?: string | null;
  messageId?: string | null;
  activityId?: string | null;
  completionId?: string | null;
  tier?: string;
  byok?: boolean;
  margin?: number;
  rates?: readonly RateEntry[];
  raw?: unknown;
}

export interface UsageRollupTaskPayload {
  events: UsageEventInsert[];
}

export interface UsageAttribution {
  projectId: string | null;
  workspaceId: string | null;
}

export interface PricedUsageDraft {
  occurredAt: string;
  period: string;
  rateVersion: string | null;
  unitCostMicros: number | null;
  costMicros: number;
  creditMicros: number;
  billable: boolean;
  byok: boolean;
  estimated: boolean;
}

function priceUsageDraft(draft: UsageEventDraft): PricedUsageDraft {
  const occurredAt = draft.occurredAt ?? new Date().toISOString();
  const priced = priceUsage(
    draft.rates ?? [],
    {
      vendor: draft.vendor,
      resource: draft.resource,
      unit: draft.unit,
      occurredAt,
      ...(draft.tier ? { tier: draft.tier } : {}),
    },
    draft.quantity,
    {
      onMissingRate: (query) => {
        logger.warn("No rate matched a usage event, recording it as estimated", {
          vendor: query.vendor,
          resource: query.resource,
          unit: query.unit,
          occurredAt: query.occurredAt,
        });
      },
    },
  );

  const byok = draft.byok === true;
  const exemptFromCredits = byok && BYOK_EXEMPT_SOURCES.has(draft.source);
  const costMicros = Math.round(priced.costMicros);

  return {
    occurredAt,
    period: usagePeriodFromDate(new Date(occurredAt)),
    rateVersion: priced.rateVersion,
    unitCostMicros: priced.unitCostMicros,
    costMicros,
    creditMicros: exemptFromCredits
      ? 0
      : creditMicrosFromCostMicros(costMicros, draft.margin ?? DEFAULT_MARGIN),
    billable: !exemptFromCredits,
    byok,
    estimated: priced.estimated,
  };
}

export function buildUsageEventRow(draft: UsageEventDraft): UsageEventInsert {
  const userId = creditActorUserId(draft.actor);

  if (userId === undefined) {
    throw new AssistantError("Usage ledger rows require a signed-in user", ErrorType.PARAMS_ERROR);
  }

  const priced = priceUsageDraft(draft);

  return {
    id: generateId(),
    idempotency_key: draft.idempotencyKey,
    user_id: userId,
    workspace_id: draft.workspaceId ?? null,
    project_id: draft.projectId ?? null,
    conversation_id: draft.conversationId ?? null,
    message_id: draft.messageId ?? null,
    activity_id: draft.activityId ?? null,
    completion_id: draft.completionId ?? null,
    occurred_at: priced.occurredAt,
    period: priced.period,
    source: draft.source,
    vendor: draft.vendor,
    resource: draft.resource,
    unit: draft.unit,
    quantity: draft.quantity,
    rate_version: priced.rateVersion,
    unit_cost_micros: priced.unitCostMicros,
    cost_micros: priced.costMicros,
    credit_micros: priced.creditMicros,
    billable: priced.billable,
    byok: priced.byok,
    estimated: priced.estimated,
    raw: draft.raw === undefined ? null : JSON.stringify(draft.raw),
  };
}

export async function resolveUsageAttribution(
  repositories: RepositoryManager,
  conversationId?: string | null,
): Promise<UsageAttribution> {
  if (!conversationId) {
    return { projectId: null, workspaceId: null };
  }

  try {
    const conversation = await repositories.conversations.getConversation(conversationId);
    const projectId = typeof conversation?.project_id === "string" ? conversation.project_id : null;

    if (!projectId) {
      return { projectId: null, workspaceId: null };
    }

    const project = await repositories.workspaces.getProject(projectId);

    return { projectId, workspaceId: project?.workspace_id ?? null };
  } catch (error) {
    logger.warn("Failed to resolve usage attribution", { error, conversationId });

    return { projectId: null, workspaceId: null };
  }
}

export async function applyUsageRollup(
  repositories: RepositoryManager,
  events: readonly UsageEventInsert[],
): Promise<{ inserted: number }> {
  const seeds = new Map<number, UsagePlanSeed>();
  const knownUsers = new Map<number, boolean>();
  let inserted = 0;

  for (const event of events) {
    let userExists = knownUsers.get(event.user_id);

    if (userExists === undefined) {
      userExists = Boolean(await repositories.users.getUserById(event.user_id));
      knownUsers.set(event.user_id, userExists);
    }

    if (!userExists) {
      logger.warn("Dropped a usage event for an account that no longer exists", {
        userId: event.user_id,
        idempotencyKey: event.idempotency_key,
      });

      continue;
    }

    let seed = seeds.get(event.user_id);

    if (!seed) {
      seed = await resolveUsagePlanSeed(repositories, event.user_id);
      seeds.set(event.user_id, seed);
    }

    const isNew = await repositories.usageEvents.insertEventAndApplyBalance(event, seed);

    if (!isNew) {
      continue;
    }

    inserted += 1;
  }

  return { inserted };
}

export interface EmitUsageEventsParams {
  env: IEnv;
  repositories: RepositoryManager;
  drafts: readonly UsageEventDraft[];
}

export type UsageEmissionOutcome = "queued" | "written" | "skipped" | "failed";

async function commitAnonymousSpend(
  repositories: RepositoryManager,
  drafts: readonly UsageEventDraft[],
): Promise<void> {
  const totals = new Map<string, { actor: CreditActor; period: string; creditMicros: number }>();

  for (const draft of drafts) {
    let priced: PricedUsageDraft;

    try {
      priced = priceUsageDraft(draft);
    } catch (error) {
      logger.error("Failed to price an anonymous usage draft", { error });

      continue;
    }

    if (!priced.billable || priced.creditMicros <= 0) {
      continue;
    }

    const actor = draft.actor;
    const key = `${actor.kind === "anonymous" ? actor.anonymousUserId : ""}:${priced.period}`;
    const existing = totals.get(key);

    if (existing) {
      existing.creditMicros += priced.creditMicros;

      continue;
    }

    totals.set(key, { actor, period: priced.period, creditMicros: priced.creditMicros });
  }

  for (const total of totals.values()) {
    try {
      await applyActorCreditDeltas({
        repositories,
        actor: total.actor,
        period: total.period,
        deltas: { spent_credit_micros: total.creditMicros },
      });
    } catch (error) {
      logger.error("Failed to commit anonymous credit spend", { error });
    }
  }
}

export async function emitUsageEvents(
  params: EmitUsageEventsParams,
): Promise<UsageEmissionOutcome> {
  const { env, repositories, drafts } = params;

  if (drafts.length === 0) {
    return "skipped";
  }

  const anonymousDrafts = drafts.filter((draft) => draft.actor.kind === "anonymous");
  const userDrafts = drafts.filter((draft) => draft.actor.kind === "user");

  if (anonymousDrafts.length > 0) {
    await commitAnonymousSpend(repositories, anonymousDrafts);
  }

  if (userDrafts.length === 0) {
    return "written";
  }

  let events: UsageEventInsert[];

  try {
    events = userDrafts.map(buildUsageEventRow);
  } catch (error) {
    logger.error("Failed to build usage events", { error });

    return "failed";
  }

  if (env.TASK_QUEUE) {
    try {
      const taskService = new TaskService(env, repositories.tasks);

      await taskService.enqueueTask({
        task_type: USAGE_ROLLUP_TASK_TYPE,
        user_id: events[0]?.user_id,
        task_data: { events } satisfies UsageRollupTaskPayload,
        priority: 2,
      });

      return "queued";
    } catch (error) {
      logger.warn("Failed to enqueue usage rollup, writing the ledger directly", { error });
    }
  }

  try {
    await applyUsageRollup(repositories, events);

    return "written";
  } catch (error) {
    logger.error("Failed to write usage events", { error });

    return "failed";
  }
}
