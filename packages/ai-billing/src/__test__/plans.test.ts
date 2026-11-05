import { describe, expect, it } from "vitest";

import { hasPlanEntitlement, isPlanOnSale, resolvePlanId } from "../plans.js";
import { resolvePlanAllowanceCredits } from "../usage/plan-seed.js";

describe("the agent plan", () => {
  const configured = {
    id: "agent",
    price: 1,
    stripe_price_id: "price_agent",
    included_credits: 1,
  };

  it("stays off sale until its price, Stripe Price and allowance are all set", () => {
    expect(isPlanOnSale({ id: "agent" })).toBe(false);
    expect(isPlanOnSale({ ...configured, stripe_price_id: null })).toBe(false);
    expect(isPlanOnSale({ ...configured, included_credits: 0 })).toBe(false);
    expect(isPlanOnSale(configured)).toBe(true);
  });

  it("does not change whether other plans are listed", () => {
    expect(isPlanOnSale({ id: "free" })).toBe(true);
  });

  it("has no built-in allowance, so nothing runs on it until one is chosen", () => {
    expect(resolvePlanAllowanceCredits("agent", null, null)).toBeNull();
  });

  it("is a real paid plan that carries pro entitlement", () => {
    expect(resolvePlanId("agent")).toBe("agent");
    expect(hasPlanEntitlement("agent", "pro")).toBe(true);
    expect(hasPlanEntitlement("agent", "enterprise")).toBe(false);
  });
});
