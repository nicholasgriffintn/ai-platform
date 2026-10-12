import { normaliseDeviceUserCode } from "@ngriffin_uk/polychat-schemas";
import { describe, expect, it } from "vitest";

import { evaluateDevicePoll } from "../device-authorisation";

const createdAt = new Date("2026-10-12T12:00:00.000Z");
const expiresAt = new Date("2026-10-12T12:10:00.000Z");

function at(seconds: number): Date {
  return new Date(createdAt.getTime() + seconds * 1000);
}

describe("evaluateDevicePoll", () => {
  it("lets a client poll once per interval since it started", () => {
    expect(evaluateDevicePoll({ createdAt, expiresAt, attempts: 0 }, at(0))).toBe("check_decision");
    expect(evaluateDevicePoll({ createdAt, expiresAt, attempts: 1 }, at(10))).toBe(
      "check_decision",
    );
    expect(evaluateDevicePoll({ createdAt, expiresAt, attempts: 3 }, at(60))).toBe(
      "check_decision",
    );
  });

  it("slows down a client that polls faster than its interval", () => {
    expect(evaluateDevicePoll({ createdAt, expiresAt, attempts: 1 }, at(5))).toBe("slow_down");
    expect(evaluateDevicePoll({ createdAt, expiresAt, attempts: 7 }, at(60))).toBe("slow_down");
  });

  it("expires the code at its deadline whatever the poll count", () => {
    expect(evaluateDevicePoll({ createdAt, expiresAt, attempts: 0 }, at(600))).toBe(
      "expired_token",
    );
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
