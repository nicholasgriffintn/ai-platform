import { describe, expect, it } from "vitest";

import { createAutomationInputSchema, describeCronExpression } from "./automations.js";

describe("describeCronExpression", () => {
  it("says a weekday morning schedule in words", () => {
    expect(describeCronExpression("0 9 * * 1-5")).toBe("every weekday at 09:00 UTC");
  });

  it("names the days when specific ones are chosen", () => {
    expect(describeCronExpression("30 7 * * 1")).toBe("every Monday at 07:30 UTC");
  });

  it("describes a daily schedule", () => {
    expect(describeCronExpression("0 18 * * *")).toBe("every day at 18:00 UTC");
  });

  it("describes a monthly schedule", () => {
    expect(describeCronExpression("0 6 1 * *")).toBe("on day 1 of each month at 06:00 UTC");
  });

  it("falls back to the expression when it cannot be said plainly", () => {
    expect(describeCronExpression("*/5 * * * *")).toBe("on the schedule */5 * * * *");
  });

  it("returns the input unchanged when it is not five fields", () => {
    expect(describeCronExpression("0 9")).toBe("0 9");
  });
});

describe("createAutomationInputSchema", () => {
  const valid = {
    recipeId: "daily-brief",
    cronExpression: "0 9 * * 1-5",
    prompt: "Summarise what changed overnight.",
  };

  it("accepts a five-field schedule", () => {
    expect(createAutomationInputSchema.safeParse(valid).success).toBe(true);
  });

  it("refuses a schedule that is not cron", () => {
    expect(
      createAutomationInputSchema.safeParse({ ...valid, cronExpression: "every morning" }).success,
    ).toBe(false);
  });

  it("refuses an empty instruction", () => {
    expect(createAutomationInputSchema.safeParse({ ...valid, prompt: "   " }).success).toBe(false);
  });
});
