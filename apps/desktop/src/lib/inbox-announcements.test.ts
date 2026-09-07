import type {
  ProjectTaskAttentionItem,
  TaskNotificationPreferences,
} from "@ngriffin_uk/polychat-schemas";
import { describe, expect, it } from "vitest";

import { readAnnouncements, readAttentionBadgeCount } from "./inbox-announcements";

const ALL_ENABLED: TaskNotificationPreferences = {
  enabled: true,
  decisions: true,
  failures: true,
  completions: true,
  assignments: true,
};

function item(overrides: Partial<ProjectTaskAttentionItem> = {}): ProjectTaskAttentionItem {
  return {
    id: "task-1:v1",
    kind: "approval",
    taskId: "task-1",
    projectId: "project-1",
    workspaceId: "workspace-1",
    projectName: "Launch",
    objective: "Approve the deploy",
    detail: null,
    conversationId: null,
    since: "2026-09-07T09:00:00Z",
    requiresAction: true,
    isRead: false,
    readAt: null,
    deepLink: "/work/acme/projects/p1/tasks/task-1",
    ...overrides,
  };
}

describe("desktop inbox announcements", () => {
  it("names what is waiting and where it came from", () => {
    const [announcement] = readAnnouncements([item()], ALL_ENABLED);

    expect(announcement.id).toBe("task-1:v1");
    expect(announcement.title).toBe("Waiting on your approval");
    expect(announcement.body).toContain("Approve the deploy");
    expect(announcement.body).toContain("Launch");
  });

  it("says nothing about an item the account has already read elsewhere", () => {
    expect(readAnnouncements([item({ isRead: true })], ALL_ENABLED)).toEqual([]);
  });

  it("honours the categories the account switched off on any device", () => {
    const withoutDecisions = { ...ALL_ENABLED, decisions: false };

    expect(readAnnouncements([item({ kind: "approval" })], withoutDecisions)).toEqual([]);
    expect(readAnnouncements([item({ kind: "blocked" })], withoutDecisions)).toHaveLength(1);
  });

  it("stays silent entirely when the account has turned notifications off", () => {
    expect(readAnnouncements([item()], { ...ALL_ENABLED, enabled: false })).toEqual([]);
  });

  it("stays silent until it knows what the account asked for", () => {
    expect(readAnnouncements([item()], undefined)).toEqual([]);
  });

  it.each(["approval", "input", "review", "blocked", "assigned", "completion"] as const)(
    "gives a %s item words of its own rather than a generic label",
    (kind) => {
      const [announcement] = readAnnouncements([item({ kind })], ALL_ENABLED);

      expect(announcement.title).toBeTruthy();
      expect(announcement.title).not.toBe("Waiting on you");
    },
  );
});

describe("the desktop attention badge", () => {
  it("counts what is waiting while task notifications are on", () => {
    expect(readAttentionBadgeCount(4, ALL_ENABLED)).toBe(4);
  });

  it("clears rather than badging once task notifications are turned off", () => {
    expect(readAttentionBadgeCount(4, { ...ALL_ENABLED, enabled: false })).toBe(0);
  });

  it("clears while the settings this account keeps are still loading", () => {
    expect(readAttentionBadgeCount(4, undefined)).toBe(0);
  });
});
