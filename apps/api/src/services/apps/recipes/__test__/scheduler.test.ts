import { beforeEach, describe, expect, it, vi } from "vitest";

import type { IEnv } from "~/types";

const mocks = vi.hoisted(() => ({
	enqueueTask: vi.fn(),
	getAppDataByApp: vi.fn(),
	updateAppData: vi.fn(),
}));

vi.mock("~/repositories", () => ({
	RepositoryManager: {
		getInstance: vi.fn(() => ({
			appData: {
				getAppDataByApp: mocks.getAppDataByApp,
				updateAppData: mocks.updateAppData,
			},
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

import { doesCronMatchDate, scheduleDueRecipeExecutions } from "../scheduler";
import { isSupportedCronExpression } from "~/utils/cron";

function createTestEnv(): IEnv {
	return Object.assign(Object.create(null), {});
}

describe("recipe scheduler", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("matches five-field cron expressions in UTC", () => {
		const date = new Date("2026-06-07T09:15:00.000Z");

		expect(doesCronMatchDate("15 9 * * *", date)).toBe(true);
		expect(doesCronMatchDate("*/15 * * * *", date)).toBe(true);
		expect(doesCronMatchDate("5-20/5 9 * * *", date)).toBe(true);
		expect(doesCronMatchDate("0 9 * * *", date)).toBe(false);
		expect(doesCronMatchDate("15 9 * * 0", date)).toBe(true);
		expect(doesCronMatchDate("15 9 * * 7", date)).toBe(true);
		expect(doesCronMatchDate("15abc 9 * * *", date)).toBe(false);
		expect(doesCronMatchDate("5-20/0 9 * * *", date)).toBe(false);
	});

	it("validates supported cron syntax and field ranges", () => {
		expect(isSupportedCronExpression("5 9 * * *")).toBe(true);
		expect(isSupportedCronExpression("5-20/5 9 * * 1,3,5")).toBe(true);
		expect(isSupportedCronExpression("0 9 * * 7")).toBe(true);
		expect(isSupportedCronExpression("60 9 * * *")).toBe(false);
		expect(isSupportedCronExpression("5 24 * * *")).toBe(false);
		expect(isSupportedCronExpression("5 9 0 * *")).toBe(false);
		expect(isSupportedCronExpression("5 9 * 13 *")).toBe(false);
		expect(isSupportedCronExpression("5 9 * * 8")).toBe(false);
		expect(isSupportedCronExpression("5-1 9 * * *")).toBe(false);
		expect(isSupportedCronExpression("*/0 9 * * *")).toBe(false);
	});

	it("enqueues due recipe executions and records the scheduled run key", async () => {
		mocks.getAppDataByApp.mockResolvedValue([
			{
				id: "installation-1",
				user_id: 42,
				app_id: "assistant_recipe_installation",
				item_id: "morning-briefing",
				item_type: "recipe_installation",
				data: JSON.stringify({
					recipeId: "morning-briefing",
					status: "active",
					triggers: [
						{ type: "manual", enabled: true },
						{
							type: "schedule",
							enabled: true,
							cronExpression: "15 9 * * *",
							prompt: "Run briefing",
							notificationChannel: "sms",
							notificationTarget: "+15551234567",
						},
					],
					configuration: {
						target: "Work inbox",
					},
				}),
				created_at: "2026-06-07T08:00:00.000Z",
				updated_at: "2026-06-07T08:00:00.000Z",
			},
		]);

		const scheduled = await scheduleDueRecipeExecutions(
			createTestEnv(),
			new Date("2026-06-07T09:15:00.000Z"),
		);

		expect(scheduled).toBe(1);
		expect(mocks.enqueueTask).toHaveBeenCalledWith(
			expect.objectContaining({
				id: expect.stringMatching(/^recipe_schedule_[a-f0-9]{40}$/),
				task_type: "recipe_execution",
				user_id: 42,
				task_data: expect.objectContaining({
					recipeId: "morning-briefing",
					installationId: "installation-1",
					input: "Run briefing",
					channel: "scheduled",
					configuration: {
						target: "Work inbox",
					},
					notificationChannel: "sms",
					notificationTarget: "+15551234567",
				}),
			}),
		);
		expect(mocks.updateAppData).toHaveBeenCalledWith(
			"installation-1",
			expect.objectContaining({
				scheduleState: {
					"1": {
						cronExpression: "15 9 * * *",
						enabled: true,
						activatedAt: "2026-06-07T08:00:00.000Z",
						lastRunKey: "1:15 9 * * *:2026-06-07T09:15",
					},
				},
			}),
		);
	});

	it("enqueues cron minutes that fell between recipe scheduler polls", async () => {
		mocks.getAppDataByApp.mockResolvedValue([
			{
				id: "installation-1",
				user_id: 42,
				app_id: "assistant_recipe_installation",
				item_id: "daily-weather",
				item_type: "recipe_installation",
				data: JSON.stringify({
					recipeId: "daily-weather",
					status: "active",
					triggers: [
						{
							type: "schedule",
							enabled: true,
							cronExpression: "5 9 * * *",
							prompt: "Run weather",
						},
					],
				}),
				created_at: "2026-06-07T08:00:00.000Z",
				updated_at: "2026-06-07T08:00:00.000Z",
			},
		]);

		const scheduled = await scheduleDueRecipeExecutions(
			createTestEnv(),
			new Date("2026-06-07T09:15:00.000Z"),
		);

		expect(scheduled).toBe(1);
		expect(mocks.enqueueTask).toHaveBeenCalledWith(
			expect.objectContaining({
				task_type: "recipe_execution",
				user_id: 42,
				task_data: expect.objectContaining({
					recipeId: "daily-weather",
					input: "Run weather",
					channel: "scheduled",
				}),
				metadata: expect.objectContaining({
					runKey: "0:5 9 * * *:2026-06-07T09:05",
				}),
			}),
		);
		expect(mocks.updateAppData).toHaveBeenCalledWith(
			"installation-1",
			expect.objectContaining({
				scheduleState: {
					"0": {
						cronExpression: "5 9 * * *",
						enabled: true,
						activatedAt: "2026-06-07T08:00:00.000Z",
						lastRunKey: "0:5 9 * * *:2026-06-07T09:05",
					},
				},
			}),
		);
	});

	it("catches the previous poll boundary when the earlier poll did not record a run", async () => {
		mocks.getAppDataByApp.mockResolvedValue([
			{
				id: "installation-1",
				user_id: 42,
				app_id: "assistant_recipe_installation",
				item_id: "daily-weather",
				item_type: "recipe_installation",
				data: JSON.stringify({
					recipeId: "daily-weather",
					status: "active",
					triggers: [
						{
							type: "schedule",
							enabled: true,
							cronExpression: "0 9 * * *",
							prompt: "Run weather",
						},
					],
				}),
				created_at: "2026-06-07T08:00:00.000Z",
				updated_at: "2026-06-07T08:00:00.000Z",
			},
		]);

		const scheduled = await scheduleDueRecipeExecutions(
			createTestEnv(),
			new Date("2026-06-07T09:15:00.000Z"),
		);

		expect(scheduled).toBe(1);
		expect(mocks.enqueueTask).toHaveBeenCalledWith(
			expect.objectContaining({
				metadata: expect.objectContaining({
					runKey: "0:0 9 * * *:2026-06-07T09:00",
				}),
			}),
		);
		expect(mocks.updateAppData).toHaveBeenCalledWith(
			"installation-1",
			expect.objectContaining({
				scheduleState: {
					"0": {
						cronExpression: "0 9 * * *",
						enabled: true,
						activatedAt: "2026-06-07T08:00:00.000Z",
						lastRunKey: "0:0 9 * * *:2026-06-07T09:00",
					},
				},
			}),
		);
	});

	it("does not enqueue a due minute from before the recipe installation existed", async () => {
		mocks.getAppDataByApp.mockResolvedValue([
			{
				id: "installation-1",
				user_id: 42,
				app_id: "assistant_recipe_installation",
				item_id: "daily-weather",
				item_type: "recipe_installation",
				data: JSON.stringify({
					recipeId: "daily-weather",
					status: "active",
					triggers: [
						{
							type: "schedule",
							enabled: true,
							cronExpression: "5 9 * * *",
							prompt: "Run weather",
						},
					],
				}),
				created_at: "2026-06-07T09:10:00.000Z",
				updated_at: "2026-06-07T09:10:00.000Z",
			},
		]);

		const scheduled = await scheduleDueRecipeExecutions(
			createTestEnv(),
			new Date("2026-06-07T09:15:00.000Z"),
		);

		expect(scheduled).toBe(0);
		expect(mocks.enqueueTask).not.toHaveBeenCalled();
		expect(mocks.updateAppData).not.toHaveBeenCalled();
	});

	it("does not enqueue a due minute before the schedule state activation instant", async () => {
		mocks.getAppDataByApp.mockResolvedValue([
			{
				id: "installation-1",
				user_id: 42,
				app_id: "assistant_recipe_installation",
				item_id: "daily-weather",
				item_type: "recipe_installation",
				data: JSON.stringify({
					recipeId: "daily-weather",
					status: "active",
					triggers: [
						{
							type: "schedule",
							enabled: true,
							cronExpression: "5 9 * * *",
							prompt: "Run weather",
						},
					],
					scheduleState: {
						"0": {
							cronExpression: "5 9 * * *",
							enabled: true,
							activatedAt: "2026-06-07T09:05:30.000Z",
						},
					},
				}),
				created_at: "2026-06-07T08:00:00.000Z",
				updated_at: "2026-06-07T09:05:30.000Z",
			},
		]);

		const scheduled = await scheduleDueRecipeExecutions(
			createTestEnv(),
			new Date("2026-06-07T09:15:00.000Z"),
		);

		expect(scheduled).toBe(0);
		expect(mocks.enqueueTask).not.toHaveBeenCalled();
		expect(mocks.updateAppData).not.toHaveBeenCalled();
	});

	it("does not enqueue duplicate work for an already recorded run key", async () => {
		mocks.getAppDataByApp.mockResolvedValue([
			{
				id: "installation-1",
				user_id: 42,
				app_id: "assistant_recipe_installation",
				item_id: "morning-briefing",
				item_type: "recipe_installation",
				data: JSON.stringify({
					recipeId: "morning-briefing",
					status: "active",
					triggers: [
						{
							type: "schedule",
							enabled: true,
							cronExpression: "15 9 * * *",
						},
					],
					scheduleState: {
						"0": {
							cronExpression: "15 9 * * *",
							enabled: true,
							activatedAt: "2026-06-07T08:00:00.000Z",
							lastRunKey: "0:15 9 * * *:2026-06-07T09:15",
						},
					},
				}),
				created_at: "2026-06-07T08:00:00.000Z",
				updated_at: "2026-06-07T08:00:00.000Z",
			},
		]);

		const scheduled = await scheduleDueRecipeExecutions(
			createTestEnv(),
			new Date("2026-06-07T09:15:00.000Z"),
		);

		expect(scheduled).toBe(0);
		expect(mocks.enqueueTask).not.toHaveBeenCalled();
		expect(mocks.updateAppData).not.toHaveBeenCalled();
	});
});
