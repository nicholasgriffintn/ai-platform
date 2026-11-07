import { beforeEach, describe, expect, it, vi } from "vitest";

import { readTaskWorkflow } from "~/modules/queue/infrastructure/workflow-instances";

import { TaskService } from "../TaskService";

vi.mock("~/modules/queue/infrastructure/workflow-instances", () => ({
  readTaskWorkflow: vi.fn(),
  terminateTaskWorkflow: vi.fn(async () => undefined),
}));

const create = vi.fn();
const repository = {
  claimTaskForDispatch: vi.fn(),
  releaseDispatchClaim: vi.fn(),
  cancelOpenTask: vi.fn(),
};
const task = {
  id: "task-1",
  task_type: "report",
  status: "pending",
  workflow_instance_id: null,
  task_data: {},
  schedule_type: "immediate",
} as any;

function service() {
  return new TaskService({ TASK_WORKFLOW: { create } } as any, repository as any);
}

describe("TaskService dispatch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    create.mockResolvedValue(undefined);
    repository.claimTaskForDispatch.mockResolvedValue(true);
  });

  it("starts one workflow when two dispatchers race for a task", async () => {
    repository.claimTaskForDispatch.mockResolvedValueOnce(true).mockResolvedValueOnce(false);

    await Promise.all([service().dispatchTask(task), service().dispatchTask(task)]);

    expect(create).toHaveBeenCalledTimes(1);
  });

  it("claims against the status and instance the caller saw", async () => {
    await service().dispatchTask({ ...task, status: "queued", workflow_instance_id: "old" });

    expect(repository.claimTaskForDispatch).toHaveBeenCalledWith(
      expect.objectContaining({ expectedStatus: "queued", expectedInstanceId: "old" }),
    );
  });

  it("returns the task to pending when the workflow was never created", async () => {
    create.mockRejectedValueOnce(new Error("create failed"));
    vi.mocked(readTaskWorkflow).mockResolvedValueOnce({ status: "unavailable" } as any);

    await expect(service().dispatchTask(task)).rejects.toThrow("create failed");

    expect(repository.releaseDispatchClaim).toHaveBeenCalledTimes(1);
  });

  it("keeps the claim when create timed out but the workflow exists", async () => {
    create.mockRejectedValueOnce(new Error("timed out"));
    vi.mocked(readTaskWorkflow).mockResolvedValueOnce({ status: "running" } as any);

    await expect(service().dispatchTask(task)).resolves.toBeUndefined();

    expect(repository.releaseDispatchClaim).not.toHaveBeenCalled();
  });

  it("does not report a cancel for a task that already finished", async () => {
    repository.cancelOpenTask.mockResolvedValueOnce(null);

    await expect(service().cancelTask("task-1")).resolves.toBe(false);
  });
});
