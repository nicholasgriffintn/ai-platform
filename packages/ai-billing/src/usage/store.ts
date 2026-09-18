import type {
  ComputeSite,
  ModelConfigItem,
  UsageEventReason,
  UsageReservationKind,
  UsageReservationStatus,
  UsageSource,
  UsageUnit,
} from "@ngriffin_uk/polychat-schemas";

export interface UsageBalanceSeed {
  planId: string | null;
  includedCreditMicros: number;
  graceCreditMicros: number;
}

export interface UsageBalanceRecord {
  plan_id: string | null;
  included_credit_micros: number;
  grace_credit_micros: number;
  spent_credit_micros: number;
  reserved_credit_micros: number;
  overrun_credit_micros: number;
  overage_credit_micros: number;
  overage_enabled: number;
  last_event_at: string | null;
}

export interface CreditDeltas {
  spent_credit_micros?: number;
  reserved_credit_micros?: number;
}

export interface ApplyUserBalanceDeltasParams {
  userId: number;
  period: string;
  planId?: string | null;
  includedCreditMicros?: number;
  graceCreditMicros?: number;
  deltas: CreditDeltas;
}

export interface AnonymousCreditSpend {
  spentCreditMicros: number;
  reservedCreditMicros: number;
}

export interface UsageEventRecord {
  id: string;
  idempotency_key: string;
  user_id: number;
  workspace_id: string | null;
  project_id: string | null;
  conversation_id: string | null;
  message_id: string | null;
  activity_id: string | null;
  completion_id: string | null;
  run_id: string | null;
  run_attempt: number | null;
  occurred_at: string;
  period: string;
  source: UsageSource;
  vendor: string;
  resource: string;
  unit: UsageUnit;
  quantity: number;
  rate_version: string | null;
  unit_cost_micros: number | null;
  cost_micros: number;
  credit_micros: number;
  billable: boolean;
  byok: boolean;
  estimated: boolean;
  vendor_units: number | null;
  reason: UsageEventReason | null;
  site: ComputeSite | null;
  raw: string | null;
}

export interface UsageReservationRecord {
  id: string;
  user_id: number;
  period: string;
  kind: UsageReservationKind;
  ref_id: string;
  credit_micros: number;
  status: UsageReservationStatus;
  expires_at: string | null;
}

export interface CreateUsageReservationParams {
  id: string;
  userId: number;
  period: string;
  kind: UsageReservationKind;
  refId: string;
  creditMicros: number;
  expiresAt?: string | null;
}

export type UsageReservationOutcome = Extract<UsageReservationStatus, "settled" | "released">;

export interface PlanAllowanceRecord {
  included_credits?: unknown;
  grace_credits?: unknown;
}

export interface UsageStore {
  getUserBalance(userId: number, period: string): Promise<UsageBalanceRecord | null>;
  applyUserBalanceDeltas(params: ApplyUserBalanceDeltasParams): Promise<void>;
  getAnonymousCreditSpend(
    anonymousUserId: string,
    period: string,
  ): Promise<AnonymousCreditSpend | null>;
  applyAnonymousCreditDeltas(
    anonymousUserId: string,
    period: string,
    deltas: CreditDeltas,
  ): Promise<void>;
  insertEventAndApplyBalance(event: UsageEventRecord, seed: UsageBalanceSeed): Promise<boolean>;
  createReservation(params: CreateUsageReservationParams): Promise<boolean>;
  createUserReservationWithBalance(
    params: CreateUsageReservationParams & UsageBalanceSeed,
  ): Promise<boolean>;
  getReservation(kind: UsageReservationKind, refId: string): Promise<UsageReservationRecord | null>;
  finishUserReservationWithBalance(
    kind: UsageReservationKind,
    refId: string,
    outcome: UsageReservationOutcome,
    expectedReservationId?: string,
  ): Promise<UsageReservationRecord | null>;
  transitionHeldReservation(
    kind: UsageReservationKind,
    refId: string,
    outcome: UsageReservationOutcome,
  ): Promise<boolean>;
  getPlanAllowance(planId: string): Promise<PlanAllowanceRecord | null>;
  getUserPlanId(userId: number): Promise<{ planId: string | null } | null>;
  conversationExists(conversationId: string): Promise<boolean>;
  getConversationProjectId(conversationId: string): Promise<string | null>;
  getProjectWorkspaceId(projectId: string): Promise<string | null>;
  hasProviderApiKey(userId: number, provider: string): Promise<boolean>;
}

export interface UsageEventPublisher {
  usageChanged(userId: number, period: string): void;
}

export interface UsageRollupPayload {
  events: UsageEventRecord[];
}

export interface UsageRuntime {
  store: UsageStore;
  publisher?: UsageEventPublisher;
  enqueueRollup?: (payload: UsageRollupPayload, userId: number | undefined) => Promise<void>;
  resolveModelConfig?: (
    model: string,
    provider?: string,
    userId?: number,
  ) => Promise<ModelConfigItem | undefined>;
}
