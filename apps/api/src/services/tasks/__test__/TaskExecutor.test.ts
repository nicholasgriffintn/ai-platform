import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	SANDBOX_RUN_DISPATCH_TASK_TYPE,
	type TaskType,
} from "@assistant/schemas";

import { TaskExecutor } from "../TaskExecutor";
import type { TaskHandler } from "../TaskHandler";
import type { TaskMessage } from "../TaskService";

const mockTaskRepository = {
	updateTask: vi.fn(),
	createTaskExecution: vi.fn(),
	updateTaskExecution: vi.fn(),
	getTaskById: vi.fn(),
};

vi.mock("~/repositories/TaskRepository", () => ({
	TaskRepository: class {
		public updateTask = mockTaskRepository.updateTask;
		public createTaskExecution = mockTaskRepository.createTaskExecution;
		public updateTaskExecution = mockTaskRepository.updateTaskExecution;
		public getTaskById = mockTaskRepository.getTaskById;
	},
}));

function createTaskMessage(taskType: TaskType | string): TaskMessage {
	return {
		taskId: "task-1",
		task_type: taskType as TaskType,
		task_data: {},
		priority: 5,
	};
}

describe("TaskExecutor", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockTaskRepository.updateTask.mockResolvedValue(undefined);
		mockTaskRepository.createTaskExecution.mockResolvedValue({ id: "exec-1" });
		mockTaskRepository.updateTaskExecution.mockResolvedValue(undefined);
		mockTaskRepository.getTaskById.mockResolvedValue({
			id: "task-1",
			attempts: 0,
			max_attempts: 3,
		});
	});

	it("skips feature-flagged task types when disabled", async () => {
		const handler: TaskHandler = {
			handle: vi.fn().mockResolvedValue({ status: "success" }),
		};
		const executor = new TaskExecutor(
			{} as any,
			new Map([["memory_synthesis", handler]]),
		);

		await executor.execute(createTaskMessage("memory_synthesis"));

		expect(handler.handle).not.toHaveBeenCalled();
		expect(mockTaskRepository.updateTask).not.toHaveBeenCalled();
	});

	it("executes always-enabled sandbox dispatch tasks without feature flags", async () => {
		const handler: TaskHandler = {
			handle: vi.fn().mockResolvedValue({ status: "success", data: {} }),
		};
		const executor = new TaskExecutor(
			{} as any,
			new Map([[SANDBOX_RUN_DISPATCH_TASK_TYPE, handler]]),
		);

		await executor.execute(createTaskMessage(SANDBOX_RUN_DISPATCH_TASK_TYPE));

		expect(handler.handle).toHaveBeenCalledTimes(1);
		expect(mockTaskRepository.updateTask).toHaveBeenNthCalledWith(
			1,
			"task-1",
			expect.objectContaining({ status: "running" }),
		);
		expect(mockTaskRepository.updateTask).toHaveBeenNthCalledWith(
			2,
			"task-1",
			expect.objectContaining({ status: "completed" }),
		);
	});

	it("returns early for unknown task types with no feature-flag mapping", async () => {
		const handler: TaskHandler = {
			handle: vi.fn().mockResolvedValue({ status: "success" }),
		};
		const executor = new TaskExecutor(
			{} as any,
			new Map([["usage_update", handler]]),
		);

		await executor.execute(createTaskMessage("invalid_type"));

		expect(handler.handle).not.toHaveBeenCalled();
		expect(mockTaskRepository.updateTask).not.toHaveBeenCalled();
	});
});
