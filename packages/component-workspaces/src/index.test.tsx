import {
  type Goal,
  type ProjectFlow,
  type ProjectTask,
  type ProjectTaskActivityTimeline,
  type ProjectTaskPlanEvidence,
  projectFlowSchema,
} from "@ngriffin_uk/polychat-schemas";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  CreateTaskDialog,
  FlowEditorDialog,
  ProjectBriefCard,
  ProjectTasksSummary,
  TaskDetail,
} from "./index";

afterEach(cleanup);

describe("ProjectBriefCard", () => {
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
      teammateId: "teammate-research",
      skillIds: [],
      mode: "explore",
      requiresApprovalFor: [],
      advance: "on_goal_complete",
    },
    {
      id: "publish",
      name: "Publish",
      instructions: null,
      teammateId: "teammate-publish",
      skillIds: [],
      mode: "build",
      requiresApprovalFor: ["write"],
      advance: "on_human_accept",
    },
  ],
};

const task: ProjectTask = {
  id: "task-1",
  originConversationId: null,
  projectId: "project-1",
  workspaceId: "workspace-1",
  key: null,
  number: null,
  kind: "task",
  description: null,
  priority: "none",
  parentTaskId: null,
  startAt: null,
  dueAt: null,
  owner: null,
  reviewer: null,
  details: {},
  objective: "Prepare the release note",
  acceptanceCriteria: [],
  assumptions: [],
  killConditions: [],
  retrospective: null,
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

const emptyActivity: ProjectTaskActivityTimeline = {
  protocolVersion: 1,
  projectId: task.projectId,
  taskId: task.id,
  items: [],
};

const emptyPlan: ProjectTaskPlanEvidence = {
  protocolVersion: 1,
  id: task.id,
  status: "active",
  stages: [
    {
      id: `${task.id}:research`,
      flowStageId: "research",
      name: "Research",
      status: "proposed",
      input: { objective: task.objective, acceptanceCriterionIds: [] },
      attempts: [],
      completionIds: [],
      outputs: [],
    },
  ],
  resume: { supported: true, reason: null },
};

describe("ProjectTasksSummary", () => {
  it("prioritises blocked and review work and fills spare space with other open tasks", () => {
    render(
      <ProjectTasksSummary
        tasks={[
          { ...task, id: "running", objective: "Running task", status: "running" },
          { ...task, id: "backlog", objective: "Backlog task", status: "backlog" },
          { ...task, id: "review", objective: "Review task", status: "review" },
          { ...task, id: "blocked", objective: "Blocked task", status: "blocked" },
          { ...task, id: "done", objective: "Done task", status: "done" },
        ]}
        boardHref="/tasks"
        taskHref={(item) => `/tasks/${item.id}`}
        onCreateTask={vi.fn()}
      />,
    );

    expect(
      screen
        .getAllByRole("link")
        .slice(1)
        .map((link) => link.getAttribute("href")),
    ).toEqual(["/tasks/blocked", "/tasks/review", "/tasks/running", "/tasks/backlog"]);
    expect(screen.getByText("4 open · 2 needing a look")).toBeTruthy();
  });

  it("reports a failed load instead of claiming the project has no tasks", () => {
    render(
      <ProjectTasksSummary
        tasks={[]}
        boardHref="/tasks"
        taskHref={() => "/tasks/1"}
        onCreateTask={vi.fn()}
        errorMessage="Tasks could not be loaded"
      />,
    );

    expect(screen.getByRole("alert").textContent).toBe("Tasks could not be loaded");
    expect(screen.queryByText("No tasks yet")).toBeNull();
  });
});

describe("TaskDetail", () => {
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
          assumptions: [],
          killConditions: [],
          retrospective: null,
        }}
        goal={completedGoal}
        activity={emptyActivity}
        plan={{ ...emptyPlan, status: "completed" }}
        flow={flow}
        work={{
          directory: { people: [], teammates: [] },
          subTasks: [],
          links: [],
          thread: [],
          currentUserId: null,
          standupDraft: null,
          onRename: vi.fn(),
          onDescribe: vi.fn(),
          onAssign: vi.fn(),
          onSetReviewer: vi.fn(),
          onSetPriority: vi.fn(),
          onSetDueAt: vi.fn(),
          onComment: vi.fn(),
          onAddSubTask: vi.fn(),
          onRaiseCase: vi.fn(),
          onEscalate: vi.fn(),
          onResolveCase: vi.fn(),
          onSendCaseReply: vi.fn(),
          onClearEscalation: vi.fn(),
          onSendAgain: vi.fn(),
          onAcceptBreakdown: vi.fn(),
          onAnswerStandup: vi.fn(),
          onUnlink: vi.fn(),
        }}
        blockedBy={[]}
        conversationHref="/chat?completion_id=conversation-2"
        originConversationHref={null}
        taskHref={() => "/tasks/task-1"}
        runHref={() => "/chat?run_id=run-1"}
        title="Project › TASK-1"
        outputHref={() => "/outputs/output-1"}
        outputs={[]}
        onRun={vi.fn()}
        onAccept={vi.fn()}
        onCancel={vi.fn()}
        onReopen={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    expect(screen.getByRole("link", { name: "Open run" })).toBeTruthy();
    expect(
      screen.getByText(
        "Executed plans keep their evidence. Create a new task to run the work again.",
      ),
    ).toBeTruthy();
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
        teammates={[{ id: "teammate-research", name: "Researcher" }]}
        skills={[
          { id: "source-research", name: "Source research" },
          { id: "fact-checking", name: "Fact checking" },
        ]}
        capabilitiesHref="/projects/project-1/teammates"
        createTeammateHref="/work/workspace-1/projects/project-1/teammates/new"
        onOpenChange={vi.fn()}
        onSave={onSave}
      />,
    );

    const heading = screen.getByRole("heading", { name: "Configure the teammate pipeline" });

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

  it("applies the suggested pipeline from the workflow selector and saves valid stages", async () => {
    const onSave = vi.fn<(nextFlow: ProjectFlow) => Promise<void>>(async () => undefined);
    const props = {
      open: true,
      teammates: [],
      skills: [],
      capabilitiesHref: "/projects/project-1/teammates",
      createTeammateHref: "/work/workspace-1/projects/project-1/teammates/new",
      onOpenChange: vi.fn(),
      onSave,
    };

    render(<FlowEditorDialog {...props} flow={null} />);
    fireEvent.click(screen.getByRole("button", { name: "Start from a workflow" }));
    fireEvent.click(
      screen.getByRole("menuitem", { name: "Suggested: research → plan → build → review" }),
    );
    expect(screen.getByRole("button", { name: "Start from a workflow" }).textContent).toContain(
      "Suggested: research → plan → build → review",
    );
    fireEvent.click(screen.getByRole("button", { name: "Save pipeline" }));

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));

    const saved = projectFlowSchema.parse(onSave.mock.calls[0]?.[0]);

    expect(saved.stages.map((stage) => stage.name)).toEqual([
      "Research",
      "Plan",
      "Build",
      "Review",
    ]);
    expect(saved.stages.map((stage) => stage.advance)).toEqual([
      "on_goal_complete",
      "on_human_accept",
      "on_goal_complete",
      "on_human_accept",
    ]);
  });
});

describe("CreateTaskDialog", () => {
  it("uses the loaded pipeline and prevents repeat submissions while saving", async () => {
    let finish: () => void = () => undefined;
    const onSubmit = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    const props = {
      open: true,
      members: [],
      teammates: [],
      boardTasks: [],
      onOpenChange: vi.fn(),
      onSubmit,
    };
    const { rerender } = render(<CreateTaskDialog {...props} flow={null} />);

    rerender(<CreateTaskDialog {...props} flow={flow} />);
    fireEvent.change(screen.getByRole("textbox", { name: "Objective" }), {
      target: { value: "Wait for save" },
    });
    const button = screen.getByRole("button", { name: "Save to backlog" });

    fireEvent.click(button);
    fireEvent.submit(button.closest("form")!);
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ stageId: "research" }), "save");
    finish();
    await waitFor(() =>
      expect(screen.getByRole("textbox", { name: "Objective" }).getAttribute("value")).toBe(""),
    );
  });

  it("retains the draft and reports a rejected submission so it can be retried", async () => {
    const onSubmit = vi
      .fn()
      .mockRejectedValueOnce(new Error("Task could not be saved"))
      .mockResolvedValueOnce(undefined);

    render(
      <CreateTaskDialog
        open
        flow={flow}
        members={[]}
        teammates={[]}
        boardTasks={[]}
        onOpenChange={vi.fn()}
        onSubmit={onSubmit}
      />,
    );
    fireEvent.change(screen.getByRole("textbox", { name: "Objective" }), {
      target: { value: "Keep my draft" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save to backlog" }));
    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toContain("Task could not be saved"),
    );
    expect(screen.getByRole("textbox", { name: "Objective" }).getAttribute("value")).toBe(
      "Keep my draft",
    );
    fireEvent.click(screen.getByRole("button", { name: "Save to backlog" }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
  });

  it("creates and starts work as one explicit action", async () => {
    const onSubmit = vi.fn(async () => undefined);

    render(
      <CreateTaskDialog
        open
        flow={flow}
        members={[]}
        teammates={[]}
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
