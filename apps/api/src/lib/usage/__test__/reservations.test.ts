import { describe, expect, it, vi } from "vitest";

import type { UsageReservationRow } from "~/repositories/UsageReservationRepository";

import { containerSecondQuantities, estimateContainerRunCreditMicros } from "../containerUsage";
import {
  chatRunReservationExpiresAt,
  finishUsageReservation,
  holdUsageReservation,
} from "../reservations";

function reservationRow(overrides: Partial<UsageReservationRow> = {}): UsageReservationRow {
  return {
    id: "res-1",
    user_id: 7,
    period: "2026-09",
    kind: "sandbox",
    ref_id: "run-1",
    credit_micros: 2_800_800,
    status: "held",
    expires_at: null,
    created_at: "2026-09-01T00:00:00.000Z",
    updated_at: null,
    ...overrides,
  };
}

function createRepositories(options: {
  created?: boolean;
  reservation?: UsageReservationRow | null;
  transitioned?: boolean;
}) {
  const createReservation = vi.fn(async () => options.created ?? true);
  const getReservation = vi.fn(async () => options.reservation ?? null);
  const transitionHeldReservation = vi.fn(async () => options.transitioned ?? false);
  const applyDeltas = vi.fn(async () => {});

  return {
    createReservation,
    getReservation,
    transitionHeldReservation,
    applyDeltas,
    repositories: {
      usageReservations: { createReservation, getReservation, transitionHeldReservation },
      usageBalances: { applyDeltas },
    } as any,
  };
}

describe("holdUsageReservation", () => {
  it("bounds chat run reservations to one day", () => {
    expect(chatRunReservationExpiresAt(Date.parse("2026-09-05T10:00:00.000Z"))).toBe(
      "2026-09-06T10:00:00.000Z",
    );
  });

  it("reserves credit against the balance when the hold is new", async () => {
    const mocks = createRepositories({ created: true });

    const created = await holdUsageReservation({
      repositories: mocks.repositories,
      userId: 7,
      kind: "sandbox",
      refId: "run-1",
      creditMicros: 1000,
    });

    expect(created).toBe(true);
    expect(mocks.applyDeltas).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 7,
        deltas: { reserved_credit_micros: 1000 },
      }),
    );
  });

  it("does not double-reserve when the same hold already exists", async () => {
    const mocks = createRepositories({ created: false });

    const created = await holdUsageReservation({
      repositories: mocks.repositories,
      userId: 7,
      kind: "sandbox",
      refId: "run-1",
      creditMicros: 1000,
    });

    expect(created).toBe(false);
    expect(mocks.applyDeltas).not.toHaveBeenCalled();
  });
});

describe("finishUsageReservation", () => {
  it("settles a held reservation exactly once and releases the reserve", async () => {
    const mocks = createRepositories({
      reservation: reservationRow({ credit_micros: 500 }),
      transitioned: true,
    });

    const settled = await finishUsageReservation({
      repositories: mocks.repositories,
      kind: "sandbox",
      refId: "run-1",
      outcome: "settled",
    });

    expect(settled?.credit_micros).toBe(500);
    expect(mocks.transitionHeldReservation).toHaveBeenCalledWith("sandbox", "run-1", "settled");
    expect(mocks.applyDeltas).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 7,
        period: "2026-09",
        deltas: { reserved_credit_micros: -500 },
      }),
    );
  });

  it("is idempotent when the reservation was already settled", async () => {
    const mocks = createRepositories({
      reservation: reservationRow({ status: "settled" }),
      transitioned: false,
    });

    const settled = await finishUsageReservation({
      repositories: mocks.repositories,
      kind: "sandbox",
      refId: "run-1",
      outcome: "settled",
    });

    expect(settled).toBeNull();
    expect(mocks.applyDeltas).not.toHaveBeenCalled();
  });

  it("returns null when no reservation was ever held", async () => {
    const mocks = createRepositories({ reservation: null });

    const released = await finishUsageReservation({
      repositories: mocks.repositories,
      kind: "realtime",
      refId: "session-1",
      outcome: "released",
    });

    expect(released).toBeNull();
    expect(mocks.transitionHeldReservation).not.toHaveBeenCalled();
    expect(mocks.applyDeltas).not.toHaveBeenCalled();
  });
});

describe("container second arithmetic", () => {
  it("multiplies duration by the instance specification", () => {
    const quantities = containerSecondQuantities("basic", 3600);

    expect(quantities).toEqual([
      { unit: "container_vcpu_seconds", quantity: 900 },
      { unit: "container_gib_seconds", quantity: 3600 },
      { unit: "container_disk_gb_seconds", quantity: 14400 },
    ]);
  });

  it("prices a run from the Cloudflare container rates", () => {
    const creditMicros = estimateContainerRunCreditMicros(
      "basic",
      3600,
      "2026-09-01T00:00:00.000Z",
    );

    expect(creditMicros).toBe(2_800_800);
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
