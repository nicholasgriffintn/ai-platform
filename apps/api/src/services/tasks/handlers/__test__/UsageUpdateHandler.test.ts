import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	resetDailyUsage: vi.fn(),
	resetDailyUsageForAnonymousUsers: vi.fn(),
}));

vi.mock("~/repositories", () => ({
	RepositoryManager: vi.fn().mockImplementation(function RepositoryManager() {
		return {
			users: {
				resetDailyUsage: mocks.resetDailyUsage,
			},
			anonymousUsers: {
				resetDailyUsage: mocks.resetDailyUsageForAnonymousUsers,
			},
		};
	}),
}));

import { UsageUpdateHandler } from "../UsageUpdateHandler";

describe("UsageUpdateHandler", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.resetDailyUsage.mockResolvedValue({ regular: 2, pro: 1, byok: 1, total: 4 });
		mocks.resetDailyUsageForAnonymousUsers.mockResolvedValue(3);
	});

	it("resets daily usage counters in the background", async () => {
		const handler = new UsageUpdateHandler();

		const result = await handler.handle(
			{
				taskId: "task-1",
				task_type: "usage_update",
				task_data: {
					action: "reset_daily_usage",
					resetAt: "2026-06-07T00:00:00.000Z",
				},
				priority: 6,
			},
			{} as any,
		);

		expect(result).toEqual({
			status: "success",
			message: "Usage update reset_daily_usage applied",
		});
		expect(mocks.resetDailyUsage).toHaveBeenCalledWith("2026-06-07T00:00:00.000Z");
		expect(mocks.resetDailyUsageForAnonymousUsers).toHaveBeenCalledWith("2026-06-07T00:00:00.000Z");
	});
});
