import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import type {
  ComputeSite,
  RateEntry,
  UsageEventReason,
  UsageSource,
  UsageUnit,
} from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import { generateId } from "@ngriffin_uk/polychat-utility-server/id";

import { priceUsageDraft, type PricedUsageDraft } from "../usage-pricing.js";
import { applyActorCreditDeltas, creditActorUserId, type CreditActor } from "./credit-actor.js";
import { resolveUsagePlanSeed, type UsagePlanSeed } from "./plan-seed.js";
import type { UsageEventRecord, UsageRuntime, UsageStore } from "./store.js";

const logger = getLogger({ prefix: "ai-billing/ledger" });

function priceDraft(draft: UsageEventDraft): PricedUsageDraft {
  return priceUsageDraft(draft, {
    onMissingRate: (query) => {
      logger.warn("No rate matched a usage event, recording it as estimated", {
        vendor: query.vendor,
        resource: query.resource,
        unit: query.unit,
        occurredAt: query.occurredAt,
      });
    },
  });
}

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
  runId?: string | null;
  runAttempt?: number | null;
  tier?: string;
  byok?: boolean;
  margin?: number;
  rates?: readonly RateEntry[];
  raw?: unknown;
  vendorUnits?: number | null;
  reason?: UsageEventReason | null;
  site?: ComputeSite | null;
}

export interface UsageAttribution {
  projectId: string | null;
  workspaceId: string | null;
}

export function buildUsageEventRow(draft: UsageEventDraft): UsageEventRecord {
  const userId = creditActorUserId(draft.actor);

  if (userId === undefined) {
    throw new AssistantError("Usage ledger rows require a signed-in user", ErrorType.PARAMS_ERROR);
  }

  const priced = priceDraft(draft);

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
    run_id: draft.runId ?? null,
    run_attempt: draft.runAttempt ?? null,
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
    vendor_units: draft.vendorUnits ?? null,
    reason: draft.reason ?? null,
    site: draft.site ?? null,
    raw: draft.raw === undefined ? null : JSON.stringify(draft.raw),
  };
}

export async function resolveUsageAttribution(
  store: UsageStore,
  conversationId?: string | null,
): Promise<UsageAttribution> {
  if (!conversationId) {
    return { projectId: null, workspaceId: null };
  }

  try {
    const projectId = await store.getConversationProjectId(conversationId);

    if (!projectId) {
      return { projectId: null, workspaceId: null };
    }

    return { projectId, workspaceId: await store.getProjectWorkspaceId(projectId) };
  } catch (error) {
    logger.warn("Failed to resolve usage attribution", { error, conversationId });

    return { projectId: null, workspaceId: null };
  }
}

async function removeDeletedConversationAttribution(
  store: UsageStore,
  event: UsageEventRecord,
  knownConversations: Map<string, boolean>,
): Promise<UsageEventRecord> {
  const conversationId = event.conversation_id;

  if (!conversationId) {
    return event;
  }

  let conversationExists = knownConversations.get(conversationId);

  if (conversationExists === undefined) {
    conversationExists = await store.conversationExists(conversationId);
    knownConversations.set(conversationId, conversationExists);
  }

  return conversationExists ? event : { ...event, conversation_id: null };
}

export async function applyUsageRollup(
  runtime: UsageRuntime,
  events: readonly UsageEventRecord[],
): Promise<{ inserted: number }> {
  const { store, publisher } = runtime;
  const seeds = new Map<number, UsagePlanSeed>();
  const knownUsers = new Map<number, boolean>();
  const knownConversations = new Map<string, boolean>();
  const changedBalances = new Map<number, string>();
  let inserted = 0;

  for (const event of events) {
    let userExists = knownUsers.get(event.user_id);

    if (userExists === undefined) {
      userExists = (await store.getUserPlanId(event.user_id)) !== null;
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
      seed = await resolveUsagePlanSeed(store, event.user_id);
      seeds.set(event.user_id, seed);
    }

    const eventWithValidAttribution = await removeDeletedConversationAttribution(
      store,
      event,
      knownConversations,
    );
    const isNew = await store.insertEventAndApplyBalance(eventWithValidAttribution, seed);

    if (!isNew) {
      continue;
    }

    inserted += 1;

    if (event.billable && event.credit_micros !== 0) {
      changedBalances.set(event.user_id, event.period);
    }
  }

  if (publisher) {
    for (const [userId, period] of changedBalances) {
      publisher.usageChanged(userId, period);
    }
  }

  return { inserted };
}

export type UsageEmissionDelivery = "queue" | "inline";

export interface EmitUsageEventsParams {
  drafts: readonly UsageEventDraft[];
  delivery?: UsageEmissionDelivery;
}

export type UsageEmissionOutcome = "queued" | "written" | "skipped" | "failed";

async function commitAnonymousSpend(
  store: UsageStore,
  drafts: readonly UsageEventDraft[],
): Promise<void> {
  const totals = new Map<string, { actor: CreditActor; period: string; creditMicros: number }>();

  for (const draft of drafts) {
    let priced: PricedUsageDraft;

    try {
      priced = priceDraft(draft);
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
      await applyActorCreditDeltas(store, {
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
  runtime: UsageRuntime,
  params: EmitUsageEventsParams,
): Promise<UsageEmissionOutcome> {
  const { drafts, delivery = "queue" } = params;

  if (drafts.length === 0) {
    return "skipped";
  }

  const anonymousDrafts = drafts.filter((draft) => draft.actor.kind === "anonymous");
  const userDrafts = drafts.filter((draft) => draft.actor.kind === "user");

  if (anonymousDrafts.length > 0) {
    await commitAnonymousSpend(runtime.store, anonymousDrafts);
  }

  if (userDrafts.length === 0) {
    return "written";
  }

  let events: UsageEventRecord[];

  try {
    events = userDrafts.map(buildUsageEventRow);
  } catch (error) {
    logger.error("Failed to build usage events", { error });

    return "failed";
  }

  if (delivery === "queue" && runtime.enqueueRollup) {
    try {
      await runtime.enqueueRollup({ events }, events[0]?.user_id);

      return "queued";
    } catch (error) {
      logger.warn("Failed to enqueue usage rollup, writing the ledger directly", { error });
    }
  }

  try {
    await applyUsageRollup(runtime, events);

    return "written";
  } catch (error) {
    logger.error("Failed to write usage events", { error });

    return "failed";
  }
}
