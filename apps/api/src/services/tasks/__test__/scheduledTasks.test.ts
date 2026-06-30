import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	enqueueTask: vi.fn(),
}));

vi.mock("~/repositories", () => ({
	RepositoryManager: {
		getInstance: vi.fn(() => ({
			tasks: {},
		})),
	},
}));

vi.mock("~/services/tasks/TaskService", () => ({
	TaskService: vi.fn().mockImplementation(function TaskService() {
		return {
			enqueueTask: mocks.enqueueTask,
		};
	}),
}));

import { scheduleDailyUsageReset } from "../scheduledTasks";

describe("scheduled tasks", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("enqueues one idempotent usage reset task for the UTC day", async () => {
		await scheduleDailyUsageReset({} as any, new Date("2026-06-07T00:00:00.000Z"));

		expect(mocks.enqueueTask).toHaveBeenCalledTimes(1);
		expect(mocks.enqueueTask).toHaveBeenCalledWith({
			id: "usage_reset_2026-06-07",
			task_type: "usage_update",
			task_data: {
				action: "reset_daily_usage",
				resetAt: "2026-06-07T00:00:00.000Z",
			},
			priority: 6,
			metadata: {
				resetDate: "2026-06-07",
			},
		});
	});
});
