import { beforeEach, describe, expect, it, vi } from "vitest";

import { readTaskWorkflow } from "~/modules/queue/infrastructure/workflow-instances";

import { recoverErroredWorkflowTasks } from "../scheduledTasks";

const repository = vi.hoisted(() => ({
  sampleDueWorkflowTasks: vi.fn(),
  requeueErroredWorkflowTask: vi.fn(),
  failStoppedWorkflowTask: vi.fn(),
  failRunningTaskExecutions: vi.fn(),
}));

vi.mock("~/modules/queue/infrastructure/TaskRepository", () => ({
  TaskRepository: vi.fn(function TaskRepository() {
    return repository;
  }),
}));
vi.mock("~/modules/queue/infrastructure/workflow-instances", () => ({
  readTaskWorkflow: vi.fn(),
}));

const env = { TASK_WORKFLOW: {} } as any;

function sample(status: string, workflowStatus: string) {
  repository.sampleDueWorkflowTasks.mockResolvedValue([
    { id: "task-1", status, workflow_instance_id: "instance-1" },
  ]);
  vi.mocked(readTaskWorkflow).mockResolvedValue({ status: workflowStatus, error: null } as any);
}

describe("recoverErroredWorkflowTasks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    repository.requeueErroredWorkflowTask.mockResolvedValue(true);
    repository.failStoppedWorkflowTask.mockResolvedValue(true);
  });

  it("requeues a queued task whose workflow was never created", async () => {
    sample("queued", "unavailable");

    await expect(recoverErroredWorkflowTasks(env)).resolves.toBe(1);
  });

  it("does not requeue a running task on a failed workflow lookup", async () => {
    sample("running", "unavailable");

    await expect(recoverErroredWorkflowTasks(env)).resolves.toBe(0);
    expect(repository.requeueErroredWorkflowTask).not.toHaveBeenCalled();
  });

  it("recovers a task left open after its workflow completed", async () => {
    sample("running", "complete");

    await expect(recoverErroredWorkflowTasks(env)).resolves.toBe(1);
  });

  it("leaves a task that was re-dispatched since it was sampled", async () => {
    sample("running", "errored");
    repository.requeueErroredWorkflowTask.mockResolvedValue(false);
    repository.failStoppedWorkflowTask.mockResolvedValue(false);

    await expect(recoverErroredWorkflowTasks(env)).resolves.toBe(0);
    expect(repository.failRunningTaskExecutions).not.toHaveBeenCalled();
  });
});
