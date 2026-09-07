import { describe, expect, it } from "vitest";

import { PROJECT_TASK_ATTENTION_KINDS } from "./project-tasks";
import {
  isTaskNotificationCategoryEnabled,
  taskNotificationCategoryForAttentionKind,
} from "./task-notifications";

describe("task notification categories", () => {
  it.each([
    ["approval", "decisions"],
    ["input", "decisions"],
    ["review", "decisions"],
    ["blocked", "failures"],
    ["assigned", "assignments"],
    ["completion", "completions"],
  ] as const)("files an inbox %s under %s, as the server does for push", (kind, category) => {
    expect(taskNotificationCategoryForAttentionKind(kind)).toBe(category);
  });

  it("covers every kind the inbox can report", () => {
    for (const kind of PROJECT_TASK_ATTENTION_KINDS) {
      expect(taskNotificationCategoryForAttentionKind(kind)).toBeTruthy();
    }
  });

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
