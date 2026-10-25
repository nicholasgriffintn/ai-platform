import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import { describe, expect, it, vi } from "vitest";

import { runWithModelFallback, type ModelFallback } from "../model-fallback";

const outOfCredit = () =>
  new AssistantError("prepayment credits are depleted", ErrorType.PROVIDER_ERROR, 402);

function lineup(models: string[]): ModelFallback<string> {
  const remaining = [...models];

  return {
    reselect: async () => remaining.shift() ?? null,
    sameAs: (left, right) => left === right,
  };
}

describe("runWithModelFallback", () => {
  it("moves to the next model when a provider runs out of credit", async () => {
    const run = vi.fn(async (model: string) => {
      if (model === "gemini-3.5-flash") {
        throw outOfCredit();
      }

      return `answered by ${model}`;
    });

    await expect(
      runWithModelFallback("gemini-3.5-flash", lineup(["gpt-5.6-luna"]), run),
    ).resolves.toEqual({ selection: "gpt-5.6-luna", result: "answered by gpt-5.6-luna" });
    expect(run).toHaveBeenCalledTimes(2);
  });

  it("surfaces the quota error once nothing else is available", async () => {
    const error = outOfCredit();

    await expect(
      runWithModelFallback("gemini-3.5-flash", lineup(["gemini-3.5-flash"]), async () => {
        throw error;
      }),
    ).rejects.toBe(error);
  });

  it("never swaps models without a fallback or for other failures", async () => {
    const outage = new AssistantError("down", ErrorType.PROVIDER_ERROR, 503);
    const fallback = lineup(["gpt-5.6-luna"]);
    const run = vi.fn(async () => {
      throw outage;
    });

    await expect(runWithModelFallback("gemini-3.5-flash", fallback, run)).rejects.toBe(outage);
    await expect(
      runWithModelFallback("gemini-3.5-flash", undefined, async () => {
        throw outOfCredit();
      }),
    ).rejects.toThrow("prepayment credits are depleted");
    expect(run).toHaveBeenCalledTimes(1);
  });
});
