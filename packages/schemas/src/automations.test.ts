import { describe, expect, it } from "vitest";

import { createAutomationInputSchema } from "./automations.js";

describe("createAutomationInputSchema", () => {
  const valid = {
    recipeId: "daily-brief",
    cronExpression: "0 9 * * 1-5",
    prompt: "Summarise what changed overnight.",
  };

  it("refuses a schedule that is not cron", () => {
    expect(
      createAutomationInputSchema.safeParse({ ...valid, cronExpression: "every morning" }).success,
    ).toBe(false);
  });

  it("refuses an empty instruction", () => {
    expect(createAutomationInputSchema.safeParse({ ...valid, prompt: "   " }).success).toBe(false);
  });
});
