import { describe, expect, it } from "vitest";

import {
  PROJECT_TASK_ACTIVITY_PROTOCOL_VERSION,
  projectTaskActivityTimelineSchema,
} from "./project-tasks";

describe("project task activity timeline", () => {
  it("accepts a forward-compatible event type with safe presentation data", () => {
    expect(
      projectTaskActivityTimelineSchema.parse({
        protocolVersion: PROJECT_TASK_ACTIVITY_PROTOCOL_VERSION,
        projectId: "project-1",
        taskId: "task-1",
        items: [
          {
            protocolVersion: PROJECT_TASK_ACTIVITY_PROTOCOL_VERSION,
            id: "event-1",
            projectId: "project-1",
            taskId: "task-1",
            runId: "run-1",
            type: "future.provider.checkpoint",
            category: "run",
            status: "unknown",
            title: "Task activity",
            detail: "future.provider.checkpoint",
            items: [],
            occurredAt: "2026-09-05T12:00:00.000Z",
            sourceId: "event-1",
            actionable: false,
            terminal: false,
          },
        ],
      }).items[0],
    ).toMatchObject({ type: "future.provider.checkpoint", status: "unknown" });
  });

  it("rejects raw unstructured payloads outside the presentation contract", () => {
    expect(
      projectTaskActivityTimelineSchema.safeParse({
        protocolVersion: PROJECT_TASK_ACTIVITY_PROTOCOL_VERSION,
        projectId: "project-1",
        taskId: "task-1",
        items: [{ type: "tool.started", data: { secret: "raw tool input" } }],
      }).success,
    ).toBe(false);
  });
});
