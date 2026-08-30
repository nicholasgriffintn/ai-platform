import type { Goal, ProjectFlow, ProjectTask } from "@ngriffin_uk/polychat-schemas";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  CreateTaskDialog,
  FlowEditorDialog,
  ProjectBriefCard,
  TaskBoard,
  TaskDetail,
} from "./index";

afterEach(cleanup);

describe("ProjectBriefCard", () => {
  it("uses the shared compact icon action rather than a text button", () => {
    render(<ProjectBriefCard canManage instructions="Initial context" onSave={vi.fn()} />);

    const edit = screen.getByRole("button", { name: "Edit project brief" });

    expect(edit.textContent).toBe("");
    expect(edit.title).toBe("Edit project brief");
    expect(edit.querySelector("svg")).not.toBeNull();
  });

  it("submits the edited brief through the host callback", async () => {
    const onSave = vi.fn(async () => undefined);

    render(<ProjectBriefCard canManage instructions="Initial context" onSave={onSave} />);

    fireEvent.click(screen.getByRole("button", { name: "Edit project brief" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Project brief" }), {
      target: { value: "Updated context" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save brief" }));

    await waitFor(() => expect(onSave).toHaveBeenCalledWith("Updated context"));
    await waitFor(() => expect(screen.queryByRole("textbox")).toBeNull());
  });

  it("does not expose editing controls without management permission", () => {
    render(<ProjectBriefCard canManage={false} instructions="" onSave={vi.fn()} />);
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByText("No project instructions have been added.")).toBeTruthy();
  });
});

const flow: ProjectFlow = {
  stages: [
    {
      id: "research",
      name: "Research",
      instructions: null,
      agentId: "agent-research",
      skillIds: [],
      mode: "explore",
      requiresApprovalFor: [],
      advance: "on_goal_complete",
    },
    {
      id: "publish",
      name: "Publish",
      instructions: null,
      agentId: "agent-publish",
      skillIds: [],
      mode: "build",
      requiresApprovalFor: ["write"],
      advance: "on_human_accept",
    },
  ],
};

const task: ProjectTask = {
  id: "task-1",
  projectId: "project-1",
  workspaceId: "workspace-1",
  objective: "Prepare the release note",
  acceptanceCriteria: [],
  expectedOutput: "A reviewed release note",
  context: null,
  constraints: null,
  dependsOnTaskIds: [],
  requireApprovalFor: [],
  status: "queued",
  source: "user",
  blockedReason: null,
  blockedDetail: null,
  stageId: "research",
  runner: null,
  createdByUserId: 1,
  assigneeUserId: null,
  runnerIdentityUserId: 1,
  conversationId: null,
  goalId: null,
  dispatchTaskId: null,
  completions: [],
  position: 1000,
  tokenBudget: 20_000,
  tokensSpent: 0,
  createdAt: "2026-08-30T10:00:00.000Z",
  updatedAt: null,
  startedAt: null,
  completedAt: null,
};

describe("TaskBoard", () => {
  it("does not mark a pipeline stage as active before backlog work starts", () => {
    render(
      <TaskBoard
        tasks={[{ ...task, status: "backlog", stageId: "research" }]}
        flow={flow}
        members={[]}
        agents={[]}
        taskHref={() => "/tasks/task-1"}
        conversationHref={() => null}
        onStartTask={vi.fn()}
        onAcceptTask={vi.fn()}
        onCreateTask={vi.fn()}
        onConfigureFlow={vi.fn()}
        canCreateTask
        canManageFlow
      />,
    );

    const progress = screen.getByLabelText("Pipeline progress");

    expect(progress.querySelector('[title="Research"]')?.className).not.toContain(
      "border-blue-500",
    );
    expect(
      Array.from(progress.children).map((part) => part.getAttribute("title") ?? "connector"),
    ).toEqual(["Research", "connector", "Publish"]);
  });

  it("filters queued work by search, status, and pipeline stage", () => {
    render(
      <TaskBoard
        tasks={[
          { ...task, id: "task-backlog", objective: "Write the launch spec", status: "backlog" },
          {
            ...task,
            id: "task-attention",
            objective: "Publish the launch note",
            status: "blocked",
            blockedReason: "awaiting_input",
            stageId: "publish",
          },
          {
            ...task,
            id: "task-done",
            objective: "Summarise the launch",
            status: "done",
            stageId: "publish",
          },
        ]}
        flow={flow}
        members={[]}
        agents={[]}
        taskHref={(item) => `/tasks/${item.id}`}
        conversationHref={() => null}
        onStartTask={vi.fn()}
        onAcceptTask={vi.fn()}
        onCreateTask={vi.fn()}
        onConfigureFlow={vi.fn()}
        canCreateTask
        canManageFlow
      />,
    );

    fireEvent.change(screen.getByRole("searchbox", { name: "Search work queue" }), {
      target: { value: "publish" },
    });
    expect(screen.getByText("Publish the launch note")).toBeTruthy();
    expect(screen.queryByText("Write the launch spec")).toBeNull();

    fireEvent.change(screen.getByRole("searchbox", { name: "Search work queue" }), {
      target: { value: "" },
    });
    fireEvent.change(screen.getByRole("combobox", { name: "Filter work by status" }), {
      target: { value: "attention" },
    });
    expect(screen.getByText("Publish the launch note")).toBeTruthy();
    expect(screen.queryByText("Summarise the launch")).toBeNull();

    fireEvent.change(screen.getByRole("combobox", { name: "Filter work by status" }), {
      target: { value: "all" },
    });
    fireEvent.change(screen.getByRole("combobox", { name: "Filter work by stage" }), {
      target: { value: "research" },
    });
    expect(screen.getByText("Write the launch spec")).toBeTruthy();
    expect(screen.queryByText("Publish the launch note")).toBeNull();
    expect(screen.getByText("1 of 3")).toBeTruthy();
  });

  it("shows the configured agent pipeline and recovers queued work without a dispatch", () => {
    const onStartTask = vi.fn();

    render(
      <TaskBoard
        tasks={[task]}
        flow={flow}
        members={[]}
        agents={[
          { id: "agent-research", name: "Researcher" },
          { id: "agent-publish", name: "Publisher" },
        ]}
        taskHref={() => "/tasks/task-1"}
        conversationHref={() => null}
        onStartTask={onStartTask}
        onAcceptTask={vi.fn()}
        onCreateTask={vi.fn()}
        onConfigureFlow={vi.fn()}
        canCreateTask
        canManageFlow
      />,
    );

    expect(screen.getByText("Auto hand-off")).toBeTruthy();
    expect(screen.getByText("Human review")).toBeTruthy();
    expect(screen.getAllByText("Researcher").length).toBeGreaterThan(0);
    expect(
      screen.getByLabelText("Pipeline progress").querySelector('[aria-current="step"]'),
    ).not.toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(onStartTask).toHaveBeenCalledWith(task);
  });

  it("offers acceptance without retry after an agent succeeds", () => {
    render(
      <TaskBoard
        tasks={[{ ...task, status: "review" }]}
        flow={flow}
        members={[]}
        agents={[]}
        taskHref={() => "/tasks/task-1"}
        conversationHref={() => null}
        onStartTask={vi.fn()}
        onAcceptTask={vi.fn()}
        onCreateTask={vi.fn()}
        onConfigureFlow={vi.fn()}
        canCreateTask
        canManageFlow
      />,
    );

    expect(screen.getByRole("button", { name: "Approve" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Retry" })).toBeNull();
  });

  it("sends stalled work to its conversation instead of retrying it", () => {
    render(
      <TaskBoard
        tasks={[
          {
            ...task,
            status: "blocked",
            blockedReason: "stalled",
            blockedDetail: "Needs a person to confirm the launch date",
            conversationId: "conversation-1",
          },
        ]}
        flow={flow}
        members={[]}
        agents={[]}
        taskHref={() => "/tasks/task-1"}
        conversationHref={() => "/chat?completion_id=conversation-1"}
        onStartTask={vi.fn()}
        onAcceptTask={vi.fn()}
        onCreateTask={vi.fn()}
        onConfigureFlow={vi.fn()}
        canCreateTask
        canManageFlow
      />,
    );

    expect(screen.queryByRole("button", { name: "Retry" })).toBeNull();
    expect(screen.getByRole("link", { name: "Respond" }).getAttribute("href")).toBe(
      "/chat?completion_id=conversation-1",
    );
  });

  it("links completed work to its result without offering retry", () => {
    render(
      <TaskBoard
        tasks={[{ ...task, status: "done", conversationId: "conversation-1" }]}
        flow={flow}
        members={[]}
        agents={[]}
        taskHref={() => "/tasks/task-1"}
        conversationHref={() => "/chat?completion_id=conversation-1"}
        onStartTask={vi.fn()}
        onAcceptTask={vi.fn()}
        onCreateTask={vi.fn()}
        onConfigureFlow={vi.fn()}
        canCreateTask
        canManageFlow
      />,
    );

    expect(screen.queryByRole("button", { name: "Retry" })).toBeNull();
    expect(screen.getByRole("link", { name: "View result" })).toBeTruthy();
    expect(
      Array.from(screen.getByLabelText("Pipeline progress").querySelectorAll("[title]")).every(
        (marker) => marker.className.includes("bg-emerald-500"),
      ),
    ).toBe(true);
  });
});

describe("TaskDetail", () => {
  it("uses the host content renderer for agent progress", () => {
    const renderProgressSummary = vi.fn((summary: string) => <strong>Rendered: {summary}</strong>);
    const goal: Goal = {
      id: "goal-1",
      conversation_id: "conversation-1",
      sandbox_run_id: null,
      user_id: 1,
      objective: task.objective,
      status: "stalled",
      source: "user",
      iteration_count: 1,
      stall_streak: 2,
      tokens_spent: 500,
      progress: [
        {
          iteration: 1,
          surface: "agent",
          summary: "**Checked** the release inputs",
          evidence: [],
          at: "2026-08-30T10:05:00.000Z",
        },
      ],
      evidence: null,
      stopped_reason: "Missing release date",
      created_at: "2026-08-30T10:00:00.000Z",
      updated_at: "2026-08-30T10:05:00.000Z",
      completed_at: null,
      last_continued_at: "2026-08-30T10:05:00.000Z",
    };

    render(
      <TaskDetail
        task={task}
        goal={goal}
        flow={flow}
        members={[]}
        agents={[]}
        blockedBy={[]}
        conversationHref={null}
        taskHref={() => "/tasks/task-1"}
        onRun={vi.fn()}
        onAccept={vi.fn()}
        onCancel={vi.fn()}
        onReopen={vi.fn()}
        onDelete={vi.fn()}
        renderProgressSummary={renderProgressSummary}
      />,
    );

    expect(renderProgressSummary).toHaveBeenCalledWith("**Checked** the release inputs");
    expect(screen.getByText("Rendered: **Checked** the release inputs")).toBeTruthy();
  });

  it("makes the accepted result primary and shows confirmed criteria as met", () => {
    const criterion = "The note includes the confirmed launch date";
    const completedGoal: Goal = {
      id: "goal-2",
      conversation_id: "conversation-2",
      sandbox_run_id: null,
      user_id: 1,
      objective: task.objective,
      status: "completed",
      source: "user",
      iteration_count: 1,
      stall_streak: 0,
      tokens_spent: 250,
      progress: [],
      evidence: [
        {
          claim: criterion,
          route: "Reviewed the final note",
          evidence_surface: "Task conversation",
          status: "confirmed",
        },
      ],
      stopped_reason: null,
      created_at: "2026-08-30T10:00:00.000Z",
      updated_at: "2026-08-30T10:05:00.000Z",
      completed_at: "2026-08-30T10:05:00.000Z",
      last_continued_at: "2026-08-30T10:05:00.000Z",
    };

    render(
      <TaskDetail
        task={{
          ...task,
          status: "done",
          conversationId: "conversation-2",
          acceptanceCriteria: [{ id: "criterion-1", text: criterion }],
        }}
        goal={completedGoal}
        flow={flow}
        members={[]}
        agents={[]}
        blockedBy={[]}
        conversationHref="/chat?completion_id=conversation-2"
        taskHref={() => "/tasks/task-1"}
        onRun={vi.fn()}
        onAccept={vi.fn()}
        onCancel={vi.fn()}
        onReopen={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    expect(screen.getByRole("link", { name: "View result" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Reopen" })).toBeNull();
    expect(screen.getByRole("button", { name: "Reopen task" })).toBeTruthy();
    expect(screen.getByLabelText(`Met: ${criterion}`)).toBeTruthy();
    expect(screen.getByText("Confirmed").getAttribute("data-slot")).toBe("badge");
  });
});

describe("FlowEditorDialog", () => {
  it("focuses its heading and saves multiple skills on one stage", async () => {
    const onSave = vi.fn(async () => undefined);

    render(
      <FlowEditorDialog
        open
        flow={{ stages: [flow.stages[0]] }}
        agents={[{ id: "agent-research", name: "Researcher" }]}
        skills={[
          { id: "source-research", name: "Source research" },
          { id: "fact-checking", name: "Fact checking" },
        ]}
        capabilitiesHref="/projects/project-1/library"
        agentsHref="/profile?tab=agents"
        onOpenChange={vi.fn()}
        onSave={onSave}
      />,
    );

    const heading = screen.getByRole("heading", { name: "Configure the agent pipeline" });

    await waitFor(() => expect(document.activeElement).toBe(heading));
    fireEvent.click(screen.getByRole("checkbox", { name: "Source research" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Fact checking" }));
    fireEvent.click(screen.getByRole("button", { name: "Save pipeline" }));

    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith({
        stages: [expect.objectContaining({ skillIds: ["source-research", "fact-checking"] })],
      }),
    );
  });
});

describe("CreateTaskDialog", () => {
  it("creates and starts work as one explicit action", async () => {
    const onSubmit = vi.fn(async () => undefined);

    render(
      <CreateTaskDialog
        open
        flow={flow}
        members={[]}
        agents={[]}
        boardTasks={[]}
        onOpenChange={vi.fn()}
        onSubmit={onSubmit}
      />,
    );

    fireEvent.change(screen.getByRole("textbox", { name: "Objective" }), {
      target: { value: "Prepare the release note" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: "Expected output" }), {
      target: { value: "A reviewed release note" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add and run" }));

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          objective: "Prepare the release note",
          expectedOutput: "A reviewed release note",
          stageId: "research",
        }),
        "run",
      ),
    );
  });
});
