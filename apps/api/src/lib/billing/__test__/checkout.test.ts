import { describe, expect, it } from "vitest";

import { requireStripePriceId } from "../checkout";

describe("requireStripePriceId", () => {
  it("rejects a zero-price plan before it reaches Stripe", () => {
    expect(() => requireStripePriceId({ price: 0, stripe_price_id: "free" }, "free")).toThrow(
      /cannot be checked out/,
    );
  });

  it("rejects a paid plan with no configured price id", () => {
    expect(() => requireStripePriceId({ price: 8 }, "pro")).toThrow(
      /Stripe price ID not configured/,
    );
  });

  it("returns the trimmed price id for a paid plan", () => {
    expect(requireStripePriceId({ price: 8, stripe_price_id: " price_123 " }, "pro")).toBe(
      "price_123",
    );
  });
});
