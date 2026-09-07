import { describe, expect, it } from "vitest";

import {
  DELEGATION_MAX_FAN_OUT,
  DELEGATION_MAX_CREDIT_SHARE,
  resolveDelegationCreditCeiling,
} from "./delegations.js";

describe("resolveDelegationCreditCeiling", () => {
  it("gives a delegate a share of what is left rather than the whole balance", () => {
    expect(resolveDelegationCreditCeiling(1_000_000)).toBe(250_000);
  });

  it("leaves the parent headroom once every delegate has taken its share", () => {
    const remaining = 1_000_000;
    const ceiling = resolveDelegationCreditCeiling(remaining);

    expect(ceiling * DELEGATION_MAX_FAN_OUT).toBeLessThan(remaining);
  });

  it("refuses to hand out a budget when nothing is left", () => {
    expect(resolveDelegationCreditCeiling(0)).toBe(0);
    expect(resolveDelegationCreditCeiling(-5_000)).toBe(0);
  });

  it("keeps the share a whole number of micros", () => {
    expect(Number.isInteger(resolveDelegationCreditCeiling(3))).toBe(true);
    expect(resolveDelegationCreditCeiling(3)).toBe(0);
  });

  it("stays below a full balance for any share under one", () => {
    expect(DELEGATION_MAX_CREDIT_SHARE).toBeLessThan(1);
  });
});
