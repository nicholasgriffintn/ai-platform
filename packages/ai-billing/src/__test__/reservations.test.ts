import { describe, expect, it } from "vitest";

import {
  containerSecondQuantities,
  estimateContainerRunCreditMicros,
} from "../usage/container-usage.js";
import {
  chatRunReservationExpiresAt,
  finishUsageReservation,
  holdUsageReservation,
} from "../usage/reservations.js";
import type { UsageReservationRecord } from "../usage/store.js";
import { createFakeRuntime } from "./fake-usage-store.js";

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
  it("bounds chat run reservations to one day", () => {
    expect(chatRunReservationExpiresAt(Date.parse("2026-09-05T10:00:00.000Z"))).toBe(
      "2026-09-06T10:00:00.000Z",
    );
  });

  it("reserves credit against the balance when the hold is new", async () => {
    const { store, publisher, runtime } = createFakeRuntime({ created: true });

    const created = await holdUsageReservation(runtime, {
      userId: 7,
      kind: "sandbox",
      refId: "run-1",
      creditMicros: 1000,
    });

    expect(created).toBe(true);
    expect(store.applyUserBalanceDeltas).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 7, deltas: { reserved_credit_micros: 1000 } }),
    );
    expect(publisher.usageChanged).toHaveBeenCalledWith(7, expect.any(String));
  });

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
  it("settles a held reservation exactly once and releases the reserve", async () => {
    const { store, runtime } = createFakeRuntime({
      reservation: reservation({ credit_micros: 500 }),
      transitioned: true,
    });

    const settled = await finishUsageReservation(runtime, {
      kind: "sandbox",
      refId: "run-1",
      outcome: "settled",
    });

    expect(settled?.credit_micros).toBe(500);
    expect(store.transitionHeldReservation).toHaveBeenCalledWith("sandbox", "run-1", "settled");
    expect(store.applyUserBalanceDeltas).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 7,
        period: "2026-09",
        deltas: { reserved_credit_micros: -500 },
      }),
    );
  });

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

  it("finishes chat run reservations through the atomic balance path", async () => {
    const { store, publisher, runtime } = createFakeRuntime({
      reservation: reservation({ kind: "chat_run" }),
    });

    await finishUsageReservation(runtime, {
      kind: "chat_run",
      refId: "run-1",
      outcome: "released",
      reservationId: "res-1",
    });

    expect(store.finishUserReservationWithBalance).toHaveBeenCalledWith(
      "chat_run",
      "run-1",
      "released",
      "res-1",
    );
    expect(store.transitionHeldReservation).not.toHaveBeenCalled();
    expect(publisher.usageChanged).toHaveBeenCalledWith(7, "2026-09");
  });

  it("returns null when no reservation was ever held", async () => {
    const { store, runtime } = createFakeRuntime({ reservation: null });

    const released = await finishUsageReservation(runtime, {
      kind: "realtime",
      refId: "session-1",
      outcome: "released",
    });

    expect(released).toBeNull();
    expect(store.transitionHeldReservation).not.toHaveBeenCalled();
    expect(store.applyUserBalanceDeltas).not.toHaveBeenCalled();
  });
});

describe("container second arithmetic", () => {
  it("multiplies duration by the instance specification", () => {
    expect(containerSecondQuantities("basic", 3600)).toEqual([
      { unit: "container_vcpu_seconds", quantity: 900 },
      { unit: "container_gib_seconds", quantity: 3600 },
      { unit: "container_disk_gb_seconds", quantity: 14400 },
    ]);
  });

  it("prices a run from the Cloudflare container rates", () => {
    expect(estimateContainerRunCreditMicros("basic", 3600, "2026-09-01T00:00:00.000Z")).toBe(
      2_800_800,
    );
  });

  it("treats negative and non-finite durations as zero", () => {
    expect(containerSecondQuantities("lite", -30)).toEqual([
      { unit: "container_vcpu_seconds", quantity: 0 },
      { unit: "container_gib_seconds", quantity: 0 },
      { unit: "container_disk_gb_seconds", quantity: 0 },
    ]);
    expect(estimateContainerRunCreditMicros("lite", Number.NaN)).toBe(0);
  });
});
