import type { ProjectFlow, ProjectTask } from "@ngriffin_uk/polychat-schemas";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CreateTaskDialog, ProjectBriefCard, TaskBoard } from "./index";

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
      skillId: null,
      mode: "explore",
      requiresApprovalFor: [],
      advance: "on_goal_complete",
    },
    {
      id: "publish",
      name: "Publish",
      instructions: null,
      agentId: "agent-publish",
      skillId: null,
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
  position: 1000,
  tokenBudget: 20_000,
  tokensSpent: 0,
  createdAt: "2026-08-30T10:00:00.000Z",
  updatedAt: null,
  startedAt: null,
  completedAt: null,
};

describe("TaskBoard", () => {
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

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(onStartTask).toHaveBeenCalledWith(task);
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
