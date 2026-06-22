import { beforeEach, describe, expect, it, vi } from "vitest";

import { TaskService } from "../TaskService";

const taskRepository = {
	createTask: vi.fn(),
	createTaskIfAbsent: vi.fn(),
	updateTask: vi.fn(),
};

describe("TaskService", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		taskRepository.createTask.mockResolvedValue({
			id: "task-random",
			max_attempts: 3,
		});
		taskRepository.createTaskIfAbsent.mockResolvedValue({
			created: true,
			task: {
				id: "task-stable",
				max_attempts: 3,
			},
		});
		taskRepository.updateTask.mockResolvedValue(undefined);
	});

	it("does not send duplicate queue messages for an existing idempotent task", async () => {
		const send = vi.fn();
		taskRepository.createTaskIfAbsent.mockResolvedValue({
			created: false,
			task: {
				id: "recipe_schedule_existing",
				max_attempts: 3,
			},
		});
		const service = new TaskService({ TASK_QUEUE: { send } } as any, taskRepository as any);

		const taskId = await service.enqueueTask({
			id: "recipe_schedule_existing",
			task_type: "recipe_execution",
			user_id: 42,
			task_data: { recipeId: "bad-weather-alerts" },
		});

		expect(taskId).toBe("recipe_schedule_existing");
		expect(taskRepository.updateTask).not.toHaveBeenCalled();
		expect(send).not.toHaveBeenCalled();
	});
});
