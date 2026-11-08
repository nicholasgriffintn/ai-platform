import type { ChatRun, ChatRunEvent, ProjectTask } from "@ngriffin_uk/polychat-schemas";
import { describe, expect, it } from "vitest";

import type { Message } from "~/types";

import { projectProjectTaskActivity } from "../activity";

const task = {
  id: "task-1",
  projectId: "project-1",
  createdAt: "2026-09-05T10:00:00.000Z",
  acceptanceCriteria: [
    { id: "criterion-1", text: "Publish the report" },
    { id: "criterion-2", text: "Link the evidence" },
  ],
  completions: [
    {
      id: "completion-1",
      output: "The report is ready. ".repeat(100),
      approval: { status: "pending" },
      createdAt: "2026-09-05T10:08:00.000Z",
    },
  ],
} satisfies Pick<ProjectTask, "id" | "projectId" | "createdAt" | "acceptanceCriteria"> & {
  completions: Array<{
    id: string;
    output: string;
    approval: { status: "pending" | "approved" | "rejected" };
    createdAt: string;
  }>;
};

const run: ChatRun = {
  protocolVersion: 1,
  id: "run-1",
  conversationId: "conversation-1",
  projectId: "project-1",
  projectTaskId: "task-1",
  initiatorUserId: 7,
  trigger: "user",
  status: "awaiting_input",
  attempt: 1,
  createdAt: "2026-09-05T10:01:00.000Z",
  updatedAt: "2026-09-05T10:07:00.000Z",
  startedAt: "2026-09-05T10:02:00.000Z",
  completedAt: null,
  terminalReason: null,
  lastMessageId: "interaction-message",
};

function runEvent(
  sequence: number,
  status: string,
  occurredAt: string,
  type = "response.status_changed",
): ChatRunEvent {
  return {
    protocolVersion: 1,
    id: `event-${sequence}`,
    runId: run.id,
    sequence,
    attempt: 1,
    type,
    occurredAt,
    data: { status },
  };
}

const messages: Message[] = [
  {
    id: "tool-message",
    role: "assistant",
    content: "",
    run_id: "run-1",
    timestamp: Date.parse("2026-09-05T10:04:00.000Z"),
    parts: [
      {
        type: "tool_use",
        name: "fetch_sources",
        toolCallId: "tool-1",
        input: { privateQuery: "must not be exposed" },
      },
      {
        type: "tool_result",
        name: "fetch_sources",
        toolCallId: "tool-1",
        status: "failed",
        content: { secret: "must not be exposed" },
      },
      {
        type: "tool_result",
        name: "upload_report",
        toolCallId: "tool-2",
        content: { error: "Provider refused the upload" },
      },
    ],
  },
];

describe("project task activity projection", () => {
  it("drops messages whose run identity does not match their containing run", () => {
    const timeline = projectProjectTaskActivity({
      task: { ...task, completions: [] },
      goal: null,
      interaction: null,
      runs: [
        {
          run,
          events: [],
          messages: [{ ...messages[0], run_id: "run-other" }],
        },
      ],
    });

    expect(timeline.items.some((item) => item.category === "tool")).toBe(false);
  });

  it("drops a run outside the exact project and task scope", () => {
    const timeline = projectProjectTaskActivity({
      task: { ...task, completions: [] },
      goal: null,
      interaction: null,
      runs: [
        {
          run: { ...run, projectId: "project-other", projectTaskId: "task-other" },
          events: [runEvent(1, "running", "2026-09-05T10:02:00.000Z")],
          messages,
        },
      ],
    });

    expect(timeline.items.map((item) => item.category)).toEqual(["plan"]);
  });
});
