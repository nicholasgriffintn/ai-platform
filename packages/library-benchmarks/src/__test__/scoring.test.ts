import { describe, expect, it } from "vitest";

import { evaluateCountdownExpression } from "../countdown/expression.js";

describe("countdown", () => {
  it("rejects reused numbers, inexact division and non-positive steps", () => {
    const numbers = [100, 75, 6, 4, 3, 2];

    expect(evaluateCountdownExpression("100 + 100", numbers).ok).toBe(false);
    expect(evaluateCountdownExpression("75 / 2", numbers).ok).toBe(false);
    expect(evaluateCountdownExpression("3 - 4 + 100", numbers).ok).toBe(false);
    expect(evaluateCountdownExpression("alert(1)", numbers).ok).toBe(false);
    expect(evaluateCountdownExpression("(100 + 6) × 3", numbers)).toEqual({ ok: true, value: 318 });
  });
});
