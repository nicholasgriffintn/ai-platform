import type {
  ChatRun,
  ChatRunEvent,
  Goal,
  ProjectTask,
  ProjectTaskInteraction,
} from "@ngriffin_uk/polychat-schemas";
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
  type = "run.status_changed",
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

const interaction: ProjectTaskInteraction = {
  protocolVersion: 1,
  type: "question",
  projectId: "project-1",
  taskId: "task-1",
  runId: "run-1",
  interactionId: "question-1",
  status: "pending",
  requestedAt: "2026-09-05T10:07:00.000Z",
  resolvedAt: null,
  detail: null,
  questions: [
    {
      id: "format",
      prompt: "Which format should the report use?",
      options: [{ label: "Brief", description: "A short report." }],
      allowOther: true,
    },
  ],
  answers: null,
};

const goal = {
  progress: [
    {
      iteration: 1,
      surface: "agent",
      summary: "Collected the source material",
      evidence: ["Source archive"],
      at: "2026-09-05T10:03:00.000Z",
    },
  ],
} satisfies Pick<Goal, "progress">;

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
  it("separates proposed plans from run, step, tool, interaction and output activity", () => {
    const timeline = projectProjectTaskActivity({
      task,
      goal,
      interaction,
      runs: [
        {
          run,
          events: [
            runEvent(1, "accepted", "2026-09-05T10:01:00.000Z", "run.accepted"),
            runEvent(2, "running", "2026-09-05T10:02:00.000Z"),
          ],
          messages,
        },
      ],
    });

    expect(timeline.items.map((item) => item.category)).toEqual(
      expect.arrayContaining(["plan", "run", "step", "tool", "interaction", "output"]),
    );
    expect(timeline.items.find((item) => item.category === "plan")).toMatchObject({
      status: "proposed",
      items: ["Publish the report", "Link the evidence"],
    });
    expect(timeline.items.find((item) => item.type === "goal.step.recorded")).toMatchObject({
      status: "succeeded",
      detail: "Collected the source material",
    });
    expect(timeline.items.find((item) => item.type === "tool.completed")).toMatchObject({
      status: "failed",
      title: "Tool failed",
    });
    expect(
      timeline.items.find(
        (item) => item.type === "tool.completed" && item.detail === "upload report",
      ),
    ).toMatchObject({ status: "failed" });
    expect(timeline.items.find((item) => item.type === "interaction.requested")).toMatchObject({
      status: "waiting",
      actionable: true,
    });
    expect(timeline.items[0]).toMatchObject({ category: "output", actionable: true });
    expect(JSON.stringify(timeline)).not.toContain("privateQuery");
    expect(JSON.stringify(timeline)).not.toContain("must not be exposed");
  });

  it("keeps failure, interruption and unknown future events distinct", () => {
    const timeline = projectProjectTaskActivity({
      task: { ...task, completions: [] },
      goal: null,
      interaction: null,
      runs: [
        {
          run: { ...run, status: "interrupted" },
          events: [
            runEvent(1, "failed", "2026-09-05T10:02:00.000Z"),
            runEvent(2, "interrupted", "2026-09-05T10:03:00.000Z"),
            runEvent(3, "ignored", "2026-09-05T10:04:00.000Z", "future.checkpoint"),
          ],
          messages: [],
        },
      ],
    });

    expect(timeline.items.find((item) => item.status === "failed")?.terminal).toBe(true);
    expect(timeline.items.find((item) => item.status === "interrupted")?.terminal).toBe(true);
    expect(timeline.items.find((item) => item.type === "future.checkpoint")).toMatchObject({
      title: "Task activity",
      status: "unknown",
      detail: "future.checkpoint",
    });
  });

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

  it("reconstructs a visible run state when a legacy or trimmed run has no retained event", () => {
    const timeline = projectProjectTaskActivity({
      task: { ...task, completions: [] },
      goal: null,
      interaction: null,
      runs: [{ run: { ...run, status: "interrupted" }, events: [], messages: [] }],
    });

    expect(timeline.items.find((item) => item.type === "run.snapshot")).toMatchObject({
      runId: "run-1",
      status: "interrupted",
      terminal: true,
    });
  });
});
