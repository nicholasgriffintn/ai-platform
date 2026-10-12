import { normaliseDeviceUserCode } from "@ngriffin_uk/polychat-schemas";
import { describe, expect, it } from "vitest";

import type { DeviceAuthorizationRow } from "~/infrastructure/database/schema";

import { evaluateDevicePoll } from "../device-authorization";

const now = new Date("2026-10-12T12:00:00.000Z");

type PollRecord = Pick<
  DeviceAuthorizationRow,
  "status" | "expires_at" | "last_polled_at" | "interval_seconds"
>;

function record(overrides: Partial<PollRecord> = {}): PollRecord {
  return {
    status: "pending",
    expires_at: "2026-10-12T12:10:00.000Z",
    last_polled_at: null,
    interval_seconds: 10,
    ...overrides,
  };
}

describe("evaluateDevicePoll", () => {
  it("issues a key only once the person has approved", () => {
    expect(evaluateDevicePoll(record(), now)).toEqual({
      kind: "error",
      error: "authorization_pending",
    });
    expect(evaluateDevicePoll(record({ status: "approved" }), now)).toEqual({ kind: "issue" });
  });

  it("refuses unknown, used, denied and expired codes", () => {
    expect(evaluateDevicePoll(null, now)).toMatchObject({ error: "invalid_grant" });
    expect(evaluateDevicePoll(record({ status: "consumed" }), now)).toMatchObject({
      error: "invalid_grant",
    });
    expect(evaluateDevicePoll(record({ status: "denied" }), now)).toMatchObject({
      error: "access_denied",
    });
    expect(
      evaluateDevicePoll(
        record({ status: "approved", expires_at: "2026-10-12T12:00:00.000Z" }),
        now,
      ),
    ).toMatchObject({ error: "expired_token" });
  });

  it("slows a client down that polls faster than its interval, even after approval", () => {
    expect(
      evaluateDevicePoll(
        record({ status: "approved", last_polled_at: "2026-10-12T11:59:55.000Z" }),
        now,
      ),
    ).toEqual({ kind: "error", error: "slow_down", intervalSeconds: 15 });
    expect(
      evaluateDevicePoll(record({ last_polled_at: "2026-10-12T11:59:50.000Z" }), now),
    ).toMatchObject({ error: "authorization_pending" });
  });
});

describe("normaliseDeviceUserCode", () => {
  it("accepts the code however the person types it", () => {
    expect(normaliseDeviceUserCode(" bcdf-ghjk ")).toBe("BCDFGHJK");
    expect(normaliseDeviceUserCode("BCDF GHJK")).toBe("BCDFGHJK");
  });

  it("rejects codes outside the alphabet or the wrong length", () => {
    expect(normaliseDeviceUserCode("ABCD-EFGH")).toBeNull();
    expect(normaliseDeviceUserCode("BCDF-GHJ")).toBeNull();
  });
});
