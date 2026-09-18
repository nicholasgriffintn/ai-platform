import { vi, type Mock } from "vitest";

import type {
  UsageBalanceRecord,
  UsageEventPublisher,
  UsageEventRecord,
  UsageReservationRecord,
  UsageRuntime,
  UsageStore,
} from "../usage/store.js";

export interface FakeUsageStoreOptions {
  plan?: Record<string, unknown> | null;
  balance?: Partial<UsageBalanceRecord> | null;
  userPlanId?: string | null;
  userExists?: boolean;
  insert?: (event: UsageEventRecord) => boolean;
  reservation?: UsageReservationRecord | null;
  created?: boolean;
  transitioned?: boolean;
  conversationExists?: boolean;
}

export type FakeUsageStore = { [K in keyof UsageStore]: Mock<UsageStore[K]> };

export function createFakeUsageStore(options: FakeUsageStoreOptions = {}): FakeUsageStore {
  const store: FakeUsageStore = {
    getUserBalance: vi.fn(async () =>
      options.balance
        ? {
            plan_id: null,
            included_credit_micros: 0,
            grace_credit_micros: 0,
            spent_credit_micros: 0,
            reserved_credit_micros: 0,
            overrun_credit_micros: 0,
            overage_credit_micros: 0,
            overage_enabled: 0,
            last_event_at: null,
            ...options.balance,
          }
        : null,
    ),
    applyUserBalanceDeltas: vi.fn(async () => {}),
    getAnonymousCreditSpend: vi.fn(async () => null),
    applyAnonymousCreditDeltas: vi.fn(async () => {}),
    insertEventAndApplyBalance: vi.fn(async (event) => options.insert?.(event) ?? true),
    createReservation: vi.fn(async () => options.created ?? true),
    createUserReservationWithBalance: vi.fn(async () => true),
    getReservation: vi.fn(async () => options.reservation ?? null),
    finishUserReservationWithBalance: vi.fn(async () => ({
      id: "res-1",
      user_id: 7,
      period: "2026-09",
      kind: "chat_run",
      ref_id: "run-1",
      credit_micros: 10_000_000,
      status: "settled",
      expires_at: null,
    })),
    transitionHeldReservation: vi.fn(async () => options.transitioned ?? false),
    getPlanAllowance: vi.fn(async () =>
      options.plan === undefined ? { included_credits: 500, grace_credits: 50 } : options.plan,
    ),
    getUserPlanId: vi.fn(async () =>
      options.userExists === false
        ? null
        : { planId: "userPlanId" in options ? (options.userPlanId ?? null) : "pro" },
    ),
    conversationExists: vi.fn(async () => options.conversationExists ?? true),
    getConversationProjectId: vi.fn(async () => null),
    getProjectWorkspaceId: vi.fn(async () => null),
    hasProviderApiKey: vi.fn(async () => false),
  };

  return store;
}

export function createFakeRuntime(
  options: FakeUsageStoreOptions & {
    enqueueRollup?: UsageRuntime["enqueueRollup"];
    publisher?: UsageEventPublisher;
  } = {},
): { store: FakeUsageStore; publisher: UsageEventPublisher; runtime: UsageRuntime } {
  const store = createFakeUsageStore(options);
  const publisher: UsageEventPublisher = options.publisher ?? { usageChanged: vi.fn() };
  const runtime: UsageRuntime = { store, publisher, enqueueRollup: options.enqueueRollup };

  return { store, publisher, runtime };
}
