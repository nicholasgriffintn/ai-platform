import { beforeEach, describe, expect, it, vi } from "vitest";

import type { IEnv } from "~/types";

const mocks = vi.hoisted(() => ({
  enqueueTask: vi.fn(),
  listTemplatesByKind: vi.fn(),
  listProjectCapabilities: vi.fn(),
  updateTemplate: vi.fn(),
}));

vi.mock("~/modules/templates/infrastructure/TemplateRepository", () => ({
  TemplateRepository: class {
    constructor() {
      return {
        listTemplatesByKind: mocks.listTemplatesByKind,
        updateTemplate: mocks.updateTemplate,
      };
    }
  },
}));

vi.mock("~/modules/workspaces/infrastructure/WorkspaceRepository", () => ({
  WorkspaceRepository: class {
    constructor() {
      return { listProjectCapabilities: mocks.listProjectCapabilities };
    }
  },
}));

vi.mock("~/modules/queue/infrastructure/TaskRepository", () => ({
  TaskRepository: class {
    constructor() {
      return {};
    }
  },
}));

vi.mock("~/modules/queue/application/TaskService", () => ({
  TaskService: vi.fn().mockImplementation(function TaskService() {
    return {
      enqueueTask: mocks.enqueueTask,
    };
  }),
}));

import { scheduleDueRecipeExecutions } from "../scheduler";

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
});
