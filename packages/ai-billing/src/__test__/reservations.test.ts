import { describe, expect, it } from "vitest";

import { createFakeRuntime } from "../testing/fake-usage-store.js";
import {
  containerSecondQuantities,
  estimateContainerRunCreditMicros,
} from "../usage/container-usage.js";
import { finishUsageReservation, holdUsageReservation } from "../usage/reservations.js";
import type { UsageReservationRecord } from "../usage/store.js";

function reservation(overrides: Partial<UsageReservationRecord> = {}): UsageReservationRecord {
  return {
    id: "res-1",
    user_id: 7,
    period: "2026-09",
    kind: "sandbox",
    ref_id: "run-1",
    credit_micros: 2_800_800,
    status: "held",
    expires_at: null,
    ...overrides,
  };
}

describe("holdUsageReservation", () => {
  it("does not double-reserve when the same hold already exists", async () => {
    const { store, runtime } = createFakeRuntime({ created: false });

    const created = await holdUsageReservation(runtime, {
      userId: 7,
      kind: "sandbox",
      refId: "run-1",
      creditMicros: 1000,
    });

    expect(created).toBe(false);
    expect(store.applyUserBalanceDeltas).not.toHaveBeenCalled();
  });
});

describe("finishUsageReservation", () => {
  it("is idempotent when the reservation was already settled", async () => {
    const { store, runtime } = createFakeRuntime({
      reservation: reservation({ status: "settled" }),
      transitioned: false,
    });

    const settled = await finishUsageReservation(runtime, {
      kind: "sandbox",
      refId: "run-1",
      outcome: "settled",
    });

    expect(settled).toBeNull();
    expect(store.applyUserBalanceDeltas).not.toHaveBeenCalled();
  });
});

describe("container second arithmetic", () => {
  it("treats negative and non-finite durations as zero", () => {
    expect(containerSecondQuantities("lite", -30)).toEqual([
      { unit: "container_vcpu_seconds", quantity: 0 },
      { unit: "container_gib_seconds", quantity: 0 },
      { unit: "container_disk_gb_seconds", quantity: 0 },
    ]);
    expect(estimateContainerRunCreditMicros("lite", Number.NaN)).toBe(0);
  });
});
