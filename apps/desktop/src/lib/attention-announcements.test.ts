import type { WorkAttentionItem } from "@ngriffin_uk/polychat-schemas";
import { describe, expect, it } from "vitest";

import { readAnnouncements } from "./attention-announcements";

function item(overrides: Partial<WorkAttentionItem>): WorkAttentionItem {
  return {
    id: "task-1:v1",
    kind: "approval",
    type: "task",
    resourceId: "task-1",
    workspaceId: "workspace-1",
    workspaceName: "Acme",
    projectId: "project-1",
    projectName: "Launch",
    conversationId: null,
    ownerUserId: 1,
    ownerName: "Nick",
    isUnread: true,
    title: "Approve the deploy",
    detail: null,
    occurredAt: "2026-09-07T09:00:00Z",
    ...overrides,
  };
}

describe("desktop attention announcements", () => {
  it("names what is waiting and where it came from", () => {
    const [announcement] = readAnnouncements([item({})]);

    expect(announcement.id).toBe("task-1:v1");
    expect(announcement.title).toBe("Waiting on your approval");
    expect(announcement.body).toContain("Approve the deploy");
    expect(announcement.body).toContain("Launch");
  });

  it("stays quiet about work the account has already read", () => {
    expect(readAnnouncements([item({ isUnread: false })])).toEqual([]);
  });

  it.each(["running", "completed"] as const)(
    "stays quiet about %s items, which need nothing from the account",
    (kind) => {
      expect(readAnnouncements([item({ kind })])).toEqual([]);
    },
  );

  it.each(["approval", "input", "review", "failed"] as const)(
    "announces %s items, which are waiting on the account",
    (kind) => {
      expect(readAnnouncements([item({ kind })])).toHaveLength(1);
    },
  );
});
