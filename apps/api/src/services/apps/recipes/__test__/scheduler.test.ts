import { beforeEach, describe, expect, it, vi } from "vitest";

import type { IEnv } from "~/types";

const mocks = vi.hoisted(() => ({
  enqueueTask: vi.fn(),
  listTemplatesByKind: vi.fn(),
  listProjectCapabilities: vi.fn(),
  updateTemplate: vi.fn(),
}));

vi.mock("~/repositories", () => ({
  RepositoryManager: {
    getInstance: vi.fn(() => ({
      templates: {
        listTemplatesByKind: mocks.listTemplatesByKind,
        updateTemplate: mocks.updateTemplate,
      },
      workspaces: {
        listProjectCapabilities: mocks.listProjectCapabilities,
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

import { isSupportedCronExpression } from "~/utils/cron";

import {
  doesCronMatchDate,
  RECIPE_SCHEDULE_CATCH_UP_POLICY,
  scheduleDueRecipeExecutions,
} from "../scheduler";

function createTestEnv(): IEnv {
  return Object.assign(Object.create(null), {});
}

describe("recipe scheduler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.updateTemplate.mockResolvedValue({ id: "installation-1" });
    mocks.listProjectCapabilities.mockResolvedValue([
      { kind: "recipe", capability_id: "morning-briefing" },
    ]);
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

  it("uses explicit Europe/London DST and missed-occurrence semantics", async () => {
    expect(RECIPE_SCHEDULE_CATCH_UP_POLICY).toEqual({
      maximumOccurrencesPerTrigger: 4,
      maximumLookbackMinutes: 44_640,
    });
    mocks.listTemplatesByKind.mockResolvedValue([
      {
        id: "installation-1",
        kind: "recipe",
        created_by_user_id: 42,
        capability_id: "daily-weather",
        status: "active",
        configuration: JSON.stringify({
          recipeId: "daily-weather",
          status: "active",
          triggers: [
            {
              id: "dst-schedule",
              type: "schedule",
              enabled: true,
              cronExpression: "30 1 * * *",
              timezone: "Europe/London",
            },
          ],
          scheduleState: {
            "dst-schedule": {
              triggerId: "dst-schedule",
              cronExpression: "30 1 * * *",
              timezone: "Europe/London",
              enabled: true,
              activatedAt: "2026-10-24T00:30:00.000Z",
              lastRunKey: "dst-schedule:2026-10-24T00:30",
            },
          },
        }),
        created_at: "2026-10-24T00:30:00.000Z",
        updated_at: "2026-10-24T00:30:00.000Z",
      },
    ]);

    await expect(
      scheduleDueRecipeExecutions(createTestEnv(), new Date("2026-10-25T01:45:00.000Z")),
    ).resolves.toBe(2);
    expect(mocks.enqueueTask.mock.calls.map(([task]) => task.metadata.runKey)).toEqual([
      "dst-schedule:2026-10-25T00:30",
      "dst-schedule:2026-10-25T01:30",
    ]);

    vi.clearAllMocks();
    mocks.updateTemplate.mockResolvedValue({ id: "installation-1" });
    mocks.listTemplatesByKind.mockResolvedValue([
      {
        id: "installation-1",
        kind: "recipe",
        created_by_user_id: 42,
        capability_id: "daily-weather",
        status: "active",
        configuration: JSON.stringify({
          recipeId: "daily-weather",
          status: "active",
          triggers: [
            {
              id: "dst-schedule",
              type: "schedule",
              enabled: true,
              cronExpression: "30 1 * * *",
              timezone: "Europe/London",
            },
          ],
          scheduleState: {
            "dst-schedule": {
              triggerId: "dst-schedule",
              cronExpression: "30 1 * * *",
              timezone: "Europe/London",
              enabled: true,
              activatedAt: "2026-03-28T01:30:00.000Z",
              lastRunKey: "dst-schedule:2026-03-28T01:30",
            },
          },
        }),
        created_at: "2026-03-28T01:30:00.000Z",
        updated_at: "2026-03-28T01:30:00.000Z",
      },
    ]);

    await expect(
      scheduleDueRecipeExecutions(createTestEnv(), new Date("2026-03-29T01:45:00.000Z")),
    ).resolves.toBe(0);
    expect(mocks.enqueueTask).not.toHaveBeenCalled();
  });

  it("enqueues due recipe executions and records the scheduled run key", async () => {
    mocks.listTemplatesByKind.mockResolvedValue([
      {
        id: "installation-1",
        kind: "recipe",
        created_by_user_id: 42,
        project_id: "project-1",
        capability_id: "morning-briefing",
        status: "active",
        configuration: JSON.stringify({
          recipeId: "morning-briefing",
          status: "active",
          triggers: [
            { id: "manual-1", type: "manual", enabled: true },
            {
              id: "schedule-1",
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
        project_id: "project-1",
        task_data: expect.objectContaining({
          recipeId: "morning-briefing",
          installationId: "installation-1",
          projectId: "project-1",
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
    expect(mocks.updateTemplate).toHaveBeenCalledWith(
      "installation-1",
      expect.objectContaining({
        configuration: expect.objectContaining({
          scheduleState: {
            "schedule-1": {
              triggerId: "schedule-1",
              cronExpression: "15 9 * * *",
              timezone: "UTC",
              enabled: true,
              activatedAt: "2026-06-07T08:00:00.000Z",
              lastRunKey: "schedule-1:2026-06-07T09:15",
            },
          },
        }),
      }),
    );
  });

  it("does not schedule a project recipe after its capability is removed", async () => {
    mocks.listProjectCapabilities.mockResolvedValue([]);
    mocks.listTemplatesByKind.mockResolvedValue([
      {
        id: "installation-1",
        kind: "recipe",
        created_by_user_id: 42,
        project_id: "project-1",
        capability_id: "morning-briefing",
        status: "active",
        configuration: JSON.stringify({
          recipeId: "morning-briefing",
          status: "active",
          triggers: [{ type: "schedule", enabled: true, cronExpression: "15 9 * * *" }],
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
  });

  it("enqueues cron minutes that fell between recipe scheduler polls", async () => {
    mocks.listTemplatesByKind.mockResolvedValue([
      {
        id: "installation-1",
        kind: "recipe",
        created_by_user_id: 42,
        capability_id: "daily-weather",
        status: "active",
        configuration: JSON.stringify({
          recipeId: "daily-weather",
          status: "active",
          triggers: [
            {
              id: "daily-schedule",
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
          runKey: "daily-schedule:2026-06-07T09:05",
        }),
      }),
    );
    expect(mocks.updateTemplate).toHaveBeenCalledWith(
      "installation-1",
      expect.objectContaining({
        configuration: expect.objectContaining({
          scheduleState: {
            "daily-schedule": {
              triggerId: "daily-schedule",
              cronExpression: "5 9 * * *",
              timezone: "UTC",
              enabled: true,
              activatedAt: "2026-06-07T08:00:00.000Z",
              lastRunKey: "daily-schedule:2026-06-07T09:05",
            },
          },
        }),
      }),
    );
  });

  it("catches the previous poll boundary when the earlier poll did not record a run", async () => {
    mocks.listTemplatesByKind.mockResolvedValue([
      {
        id: "installation-1",
        kind: "recipe",
        created_by_user_id: 42,
        capability_id: "daily-weather",
        status: "active",
        configuration: JSON.stringify({
          recipeId: "daily-weather",
          status: "active",
          triggers: [
            {
              id: "daily-schedule",
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
          runKey: "daily-schedule:2026-06-07T09:00",
        }),
      }),
    );
    expect(mocks.updateTemplate).toHaveBeenCalledWith(
      "installation-1",
      expect.objectContaining({
        configuration: expect.objectContaining({
          scheduleState: {
            "daily-schedule": {
              triggerId: "daily-schedule",
              cronExpression: "0 9 * * *",
              timezone: "UTC",
              enabled: true,
              activatedAt: "2026-06-07T08:00:00.000Z",
              lastRunKey: "daily-schedule:2026-06-07T09:00",
            },
          },
        }),
      }),
    );
  });

  it("does not enqueue a due minute from before the recipe installation existed", async () => {
    mocks.listTemplatesByKind.mockResolvedValue([
      {
        id: "installation-1",
        kind: "recipe",
        created_by_user_id: 42,
        capability_id: "daily-weather",
        configuration: JSON.stringify({
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
    expect(mocks.updateTemplate).not.toHaveBeenCalled();
  });

  it("does not enqueue a due minute before the schedule state activation instant", async () => {
    mocks.listTemplatesByKind.mockResolvedValue([
      {
        id: "installation-1",
        kind: "recipe",
        created_by_user_id: 42,
        capability_id: "daily-weather",
        configuration: JSON.stringify({
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
    expect(mocks.updateTemplate).not.toHaveBeenCalled();
  });

  it("does not enqueue duplicate work for an already recorded run key", async () => {
    mocks.listTemplatesByKind.mockResolvedValue([
      {
        id: "installation-1",
        kind: "recipe",
        created_by_user_id: 42,
        capability_id: "morning-briefing",
        configuration: JSON.stringify({
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
    expect(mocks.updateTemplate).not.toHaveBeenCalled();
  });
});
