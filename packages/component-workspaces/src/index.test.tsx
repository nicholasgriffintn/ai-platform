import { type Goal, createSequentialProjectFlow } from "@ngriffin_uk/polychat-schemas";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { flow, task, emptyActivity, emptyPlan } from "../test/project-task-fixtures";
import {
  CreateTaskDialog,
  FlowEditorDialog,
  ProjectBriefCard,
  ProjectTasksSummary,
  TaskBoard,
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

describe("TaskBoard", () => {
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
            nodeId: "publish",
          },
          {
            ...task,
            id: "task-done",
            objective: "Summarise the launch",
            status: "done",
            nodeId: "publish",
          },
        ]}
        flow={flow}
        members={[]}
        teammates={[]}
        taskHref={(item) => `/tasks/${item.id}`}
        conversationHref={() => null}
        onStartTask={vi.fn()}
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
    fireEvent.click(screen.getByRole("button", { name: "Filter work by status" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Needs attention" }));
    expect(screen.getByText("Publish the launch note")).toBeTruthy();
    expect(screen.queryByText("Summarise the launch")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Filter work by status" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "All statuses" }));
    fireEvent.click(screen.getByRole("button", { name: "Filter work by step" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Research" }));
    expect(screen.getByText("Write the launch spec")).toBeTruthy();
    expect(screen.queryByText("Publish the launch note")).toBeNull();
    expect(screen.getByText("1 of 3")).toBeTruthy();
  });

  it("shows the configured teammate pipeline and recovers queued work without a dispatch", () => {
    const onStartTask = vi.fn();

    render(
      <TaskBoard
        tasks={[task]}
        flow={flow}
        members={[]}
        teammates={[
          { id: "teammate-research", name: "Researcher" },
          { id: "teammate-publish", name: "Publisher" },
        ]}
        taskHref={() => "/tasks/task-1"}
        conversationHref={() => null}
        onStartTask={onStartTask}
        onCreateTask={vi.fn()}
        onConfigureFlow={vi.fn()}
        canCreateTask
        canManageFlow
      />,
    );

    expect(screen.getAllByText("Researcher").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(onStartTask).toHaveBeenCalledWith(task);
  });

  it("opens the saved review without offering a blind retry", () => {
    render(
      <TaskBoard
        tasks={[{ ...task, status: "review" }]}
        flow={flow}
        members={[]}
        teammates={[]}
        taskHref={() => "/tasks/task-1"}
        conversationHref={() => null}
        onStartTask={vi.fn()}
        onCreateTask={vi.fn()}
        onConfigureFlow={vi.fn()}
        canCreateTask
        canManageFlow
      />,
    );

    expect(screen.getByRole("link", { name: "Review" }).getAttribute("href")).toBe("/tasks/task-1");
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
        teammates={[]}
        taskHref={() => "/tasks/task-1"}
        conversationHref={() => "/chat?completion_id=conversation-1"}
        onStartTask={vi.fn()}
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
        }}
        goal={completedGoal}
        activity={emptyActivity}
        plan={{ ...emptyPlan, status: "completed" }}
        members={[]}
        teammates={[]}
        blockedBy={[]}
        conversationHref="/chat?completion_id=conversation-2"
        originConversationHref={null}
        taskHref={() => "/tasks/task-1"}
        runHref={() => "/chat?run_id=run-1"}
        outputHref={() => "/outputs/output-1"}
        onRun={vi.fn()}
        flowWait={null}
        canRespondToFlowWait={false}
        onRespondToWait={vi.fn(async () => true)}
        onCancel={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    expect(screen.getByRole("link", { name: "View result" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Reopen" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Reopen task" })).toBeNull();
    expect(
      screen.getByText(
        "Create a new task to run this work again. Its evidence remains in the project.",
      ),
    ).toBeTruthy();
    expect(screen.getByLabelText(`Met: ${criterion}`)).toBeTruthy();
    expect(screen.getByText("Confirmed").getAttribute("data-slot")).toBe("badge");
  });
});

describe("FlowEditorDialog", () => {
  it("focuses its heading and saves the selected skills in a connected flow", async () => {
    const onSave = vi.fn(async () => undefined);

    render(
      <FlowEditorDialog
        open
        flow={createSequentialProjectFlow([
          {
            id: "research",
            name: "Research",
            instructions: null,
            teammateId: "teammate-research",
            skillIds: [],
            mode: "explore",
            requiresApprovalFor: [],
          },
        ])}
        members={[]}
        recordTables={[]}
        recordDefinitions={[]}
        triggerStates={[]}
        onSelectTable={vi.fn()}
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

    const heading = screen.getByRole("heading", { name: "Configure the project flow" });

    await waitFor(() => expect(document.activeElement).toBe(heading));
    fireEvent.click(screen.getByRole("checkbox", { name: "Source research" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Fact checking" }));
    fireEvent.click(screen.getByRole("button", { name: "Save flow" }));

    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({
          nodes: expect.arrayContaining([
            expect.objectContaining({ skillIds: ["source-research", "fact-checking"] }),
          ]),
        }),
      ),
    );
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
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ nodeId: "research" }), "save");
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
          nodeId: "research",
        }),
        "run",
      ),
    );
  });
});
