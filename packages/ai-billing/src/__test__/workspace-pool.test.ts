import type { ModelConfigItem } from "@ngriffin_uk/polychat-schemas";
import { describe, expect, it, vi } from "vitest";

import { createFakeRuntime } from "../testing/fake-usage-store.js";
import { runWithWorkspaceFunding } from "../usage/funding-scope.js";
import { applyUsageRollup, buildUsageEventRow } from "../usage/ledger.js";
import { recordModelTurnUsage } from "../usage/model-usage.js";
import { finishUsageReservation, holdUsageReservation } from "../usage/reservations.js";
import type { UsageEventRecord, UsageRuntime } from "../usage/store.js";
import { admitWorkspaceTurn } from "../usage/workspace-pool.js";

const pool = { included_credit_micros: 100, grace_credit_micros: 10 };
const modelConfig = {
  matchingModel: "claude",
  provider: "anthropic",
  costPer1kInputTokens: 1,
  costPer1kOutputTokens: 1,
} as ModelConfigItem;

function usageEvent(overrides: Partial<UsageEventRecord> = {}): UsageEventRecord {
  return {
    id: "event-1",
    idempotency_key: "model:message-1:input_tokens",
    user_id: 7,
    workspace_id: "workspace-1",
    project_id: "project-1",
    conversation_id: null,
    message_id: null,
    activity_id: null,
    completion_id: null,
    run_id: null,
    run_attempt: null,
    occurred_at: "2026-11-05T12:00:00.000Z",
    period: "2026-11",
    source: "model",
    vendor: "anthropic",
    resource: "claude",
    unit: "input_tokens",
    quantity: 10,
    rate_version: null,
    unit_cost_micros: null,
    cost_micros: 5,
    credit_micros: 50,
    billable: true,
    byok: false,
    estimated: false,
    vendor_units: null,
    reason: null,
    site: null,
    raw: null,
    ...overrides,
  };
}

describe("admitWorkspaceTurn", () => {
  it("holds the estimate on the pool and leaves the member's balance alone", async () => {
    const runtime = createFakeRuntime({ pool });

    const admission = await admitWorkspaceTurn(runtime, {
      workspaceId: "workspace-1",
      estimatedCreditMicros: 60,
    });

    expect(admission.admitted).toBe(true);
    expect(runtime.store.reserveWorkspacePool).toHaveBeenCalledWith(
      "workspace-1",
      expect.any(String),
      60,
    );
    expect(runtime.store.applyUserBalanceDeltas).not.toHaveBeenCalled();

    if (admission.admitted) {
      await admission.reservation?.release();
      await admission.reservation?.release();
    }

    expect(runtime.store.adjustWorkspacePoolReserved).toHaveBeenCalledOnce();
    expect(runtime.store.adjustWorkspacePoolReserved).toHaveBeenCalledWith(
      "workspace-1",
      expect.any(String),
      -60,
    );
  });

  it("stops at the pool ceiling instead of falling back to a personal balance", async () => {
    const runtime = createFakeRuntime({ pool: { ...pool, spent_credit_micros: 100 } });

    await expect(
      admitWorkspaceTurn(runtime, { workspaceId: "workspace-1", estimatedCreditMicros: 11 }),
    ).resolves.toMatchObject({ admitted: false });
    expect(runtime.store.reserveWorkspacePool).not.toHaveBeenCalled();
    expect(runtime.store.applyUserBalanceDeltas).not.toHaveBeenCalled();
  });

  it("refuses a turn that loses the race for the last of the pool", async () => {
    const runtime = createFakeRuntime({ pool, poolReserved: false });

    await expect(
      admitWorkspaceTurn(runtime, { workspaceId: "workspace-1", estimatedCreditMicros: 60 }),
    ).resolves.toMatchObject({ admitted: false });
  });

  it("refuses a turn when the team plan has gone", async () => {
    const runtime = createFakeRuntime({ pool: null });

    await expect(
      admitWorkspaceTurn(runtime, { workspaceId: "workspace-1", estimatedCreditMicros: 1 }),
    ).resolves.toMatchObject({ admitted: false, position: { enforced: false } });
  });

  it("binds a durable reservation to the workspace", async () => {
    const runtime = createFakeRuntime({ pool });

    await admitWorkspaceTurn(runtime, {
      workspaceId: "workspace-1",
      estimatedCreditMicros: 60,
      durableReservation: { kind: "chat_run", refId: "run-1", userId: 7 },
    });

    expect(runtime.store.createWorkspaceReservationWithPool).toHaveBeenCalledWith(
      expect.objectContaining({ workspaceId: "workspace-1", userId: 7, creditMicros: 60 }),
    );
    expect(runtime.store.createUserReservationWithBalance).not.toHaveBeenCalled();
  });
});

describe("applyUsageRollup with a workspace pool", () => {
  it("settles a member's billable workspace usage on the pool", async () => {
    const runtime = createFakeRuntime({ pool });
    const event = usageEvent();

    await expect(applyUsageRollup(runtime, [event])).resolves.toEqual({ inserted: 1 });

    expect(runtime.store.insertEventAndApplyPool).toHaveBeenCalledWith(event, "workspace-1");
    expect(runtime.store.insertEventAndApplyBalance).not.toHaveBeenCalled();
  });

  it.each([
    ["personal usage", { workspace_id: null }],
    ["BYOK usage", { byok: true, billable: false, credit_micros: 0 }],
  ])("keeps %s off the pool", async (_label, overrides) => {
    const runtime = createFakeRuntime({ pool });

    await applyUsageRollup(runtime, [usageEvent(overrides)]);

    expect(runtime.store.insertEventAndApplyPool).not.toHaveBeenCalled();
    expect(runtime.store.insertEventAndApplyBalance).toHaveBeenCalledOnce();
  });

  it("settles a turn on the pool that funded it after the team plan has ended", async () => {
    const runtime = createFakeRuntime({ pool: null });
    const event = usageEvent({ pool_workspace_id: "workspace-1" });

    await applyUsageRollup(runtime, [event]);

    expect(runtime.store.insertEventAndApplyPool).toHaveBeenCalledWith(event, "workspace-1");
    expect(runtime.store.insertEventAndApplyBalance).not.toHaveBeenCalled();
  });

  it("charges the member when the workspace has no team plan", async () => {
    const runtime = createFakeRuntime({ pool: null });

    await applyUsageRollup(runtime, [usageEvent()]);

    expect(runtime.store.insertEventAndApplyPool).not.toHaveBeenCalled();
    expect(runtime.store.insertEventAndApplyBalance).toHaveBeenCalledOnce();
  });
});

describe("recordModelTurnUsage with a workspace pool", () => {
  async function recordTurn(options: { pool: typeof pool | null }) {
    const enqueueRollup = vi.fn<NonNullable<UsageRuntime["enqueueRollup"]>>(async () => {});
    const { store, runtime } = createFakeRuntime({ ...options, enqueueRollup });

    runtime.resolveModelConfig = async () => modelConfig;
    store.hasProviderApiKey.mockResolvedValue(true);
    store.getConversationProjectId.mockResolvedValue("project-1");
    store.getProjectWorkspaceId.mockResolvedValue("workspace-1");

    await recordModelTurnUsage(runtime, {
      actor: { kind: "user", userId: 7 },
      usage: {
        input_tokens: 1000,
        output_tokens: 10,
        total_tokens: 1010,
        prompt_tokens: 1000,
        completion_tokens: 10,
      },
      model: "claude",
      provider: "anthropic",
      completionId: "conversation-1",
      conversationId: "conversation-1",
      messageId: "message-1",
    });

    return enqueueRollup.mock.calls[0]?.[0];
  }

  it("treats a turn as platform usage in a pooled workspace, even with a personal key", async () => {
    const rollup = await recordTurn({ pool });

    expect(rollup?.events[0]?.byok).toBe(false);
  });

  it("leaves a personal key exempt where the workspace has no team plan", async () => {
    const rollup = await recordTurn({ pool: null });

    expect(rollup?.events[0]?.byok).toBe(true);
  });
});

describe("buildUsageEventRow inside a funding scope", () => {
  const draft = {
    idempotencyKey: "system:object-1:input_tokens",
    actor: { kind: "user" as const, userId: 7 },
    source: "model" as const,
    vendor: "anthropic",
    resource: "claude",
    unit: "input_tokens" as const,
    quantity: 1000,
    rates: [
      {
        vendor: "anthropic",
        resource: "claude",
        unit: "input_tokens" as const,
        perUnitMicros: 5,
        effectiveFrom: "2026-01-01",
      },
    ],
  };

  it("carries the funding pool, even for work with no conversation to attribute", () => {
    const row = runWithWorkspaceFunding("workspace-1", () => buildUsageEventRow(draft));

    expect(row).toMatchObject({ pool_workspace_id: "workspace-1", workspace_id: "workspace-1" });
  });

  it("leaves unfunded work on the member's account", () => {
    expect(buildUsageEventRow(draft)).toMatchObject({
      pool_workspace_id: null,
      workspace_id: null,
    });
  });
});

describe("holdUsageReservation with a workspace pool", () => {
  const hold = {
    userId: 7,
    kind: "sandbox" as const,
    refId: "run-1",
    creditMicros: 40,
    workspaceId: "workspace-1",
  };

  it("holds through the pool's ceiling check, not the member's balance", async () => {
    const runtime = createFakeRuntime({ pool });

    await expect(holdUsageReservation(runtime, hold)).resolves.toBe(true);

    expect(runtime.store.createWorkspaceReservationWithPool).toHaveBeenCalledWith(
      expect.objectContaining({ workspaceId: "workspace-1", kind: "sandbox", creditMicros: 40 }),
    );
    expect(runtime.store.createReservation).not.toHaveBeenCalled();
    expect(runtime.store.applyUserBalanceDeltas).not.toHaveBeenCalled();
  });

  it("refuses a hold the pool can't cover", async () => {
    const runtime = createFakeRuntime({ pool, poolReserved: false });

    await expect(holdUsageReservation(runtime, hold)).resolves.toBe(false);
  });

  it("accepts a redelivered run whose hold is already in place", async () => {
    const runtime = createFakeRuntime({
      pool,
      poolReserved: false,
      reservation: {
        id: "reservation-1",
        user_id: 7,
        period: "2026-11",
        kind: "sandbox",
        ref_id: "run-1",
        credit_micros: 40,
        status: "held",
        expires_at: null,
        workspace_id: "workspace-1",
      },
    });

    await expect(holdUsageReservation(runtime, hold)).resolves.toBe(true);
  });
});

describe("finishUsageReservation with a workspace pool", () => {
  it("returns a held sandbox reservation to the pool it came from", async () => {
    const runtime = createFakeRuntime({
      transitioned: true,
      reservation: {
        id: "reservation-1",
        user_id: 7,
        period: "2026-11",
        kind: "sandbox",
        ref_id: "run-1",
        credit_micros: 40,
        status: "held",
        expires_at: null,
        workspace_id: "workspace-1",
      },
    });

    await finishUsageReservation(runtime, { kind: "sandbox", refId: "run-1", outcome: "released" });

    expect(runtime.store.adjustWorkspacePoolReserved).toHaveBeenCalledWith(
      "workspace-1",
      "2026-11",
      -40,
    );
    expect(runtime.store.applyUserBalanceDeltas).not.toHaveBeenCalled();
  });
});
