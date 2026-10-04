import { describe, expect, it } from "vitest";

import { isTaskNotificationCategoryEnabled } from "./task-notifications.js";

describe("task notification categories", () => {
  it("stays silent for a category the account switched off, and for all of them at once", () => {
    const preferences = {
      enabled: true,
      decisions: true,
      failures: false,
      completions: true,
      assignments: true,
    };

    expect(isTaskNotificationCategoryEnabled(preferences, "decisions")).toBe(true);
    expect(isTaskNotificationCategoryEnabled(preferences, "failures")).toBe(false);
    expect(isTaskNotificationCategoryEnabled({ ...preferences, enabled: false }, "decisions")).toBe(
      false,
    );
  });
});
