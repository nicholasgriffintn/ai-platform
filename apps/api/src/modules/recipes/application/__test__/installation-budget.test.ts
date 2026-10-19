import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  syncRecipeComposioTriggerStatus: vi.fn(),
}));

vi.mock("../composio-trigger-lifecycle", () => ({
  syncRecipeComposioTriggerStatus: mocks.syncRecipeComposioTriggerStatus,
}));

import { fakeRepositories } from "~/infrastructure/database/__test__/fake-repositories";
import { TemplateRepository } from "~/modules/templates/infrastructure/TemplateRepository";
import { UsageEventRepository } from "~/modules/usage/infrastructure/UsageEventRepository";

import {
  assertRecipeInstallationWithinBudget,
  getRecipeInstallationSpend,
} from "../installation-budget";

const getTemplateById = vi.fn();
const updateTemplate = vi.fn();
const summariseRunSpend = vi.fn();

const context = {
  repositories: fakeRepositories([
    [TemplateRepository, { getTemplateById, updateTemplate }],
    [UsageEventRepository, { summariseRunSpend }],
  ]),
} as any;

function installationRecord(data: Record<string, unknown>) {
  return {
    id: "installation-1",
    created_by_user_id: 42,
    workspace_id: null,
    project_id: null,
    kind: "recipe",
    capability_id: "notes-assistant",
    name: "Notes Assistant",
    description: "",
    configuration: JSON.stringify({
      recipeId: "notes-assistant",
      status: "active",
      triggers: [],
      ...data,
    }),
    status: "active",
    created_at: "2026-10-01T00:00:00.000Z",
    updated_at: "2026-10-01T00:00:00.000Z",
  };
}

const params = { context, userId: 42, installationId: "installation-1" };

describe("routine budgets", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    updateTemplate.mockResolvedValue({});
    mocks.syncRecipeComposioTriggerStatus.mockResolvedValue(undefined);
  });

  it("reports spend against the cap", async () => {
    getTemplateById.mockResolvedValue(installationRecord({ monthlyCreditCapMicros: 5_000_000 }));
    summariseRunSpend.mockResolvedValue({
      credit_micros: 4_200_000,
      cost_micros: 1_000,
      run_count: 3,
    });

    await expect(getRecipeInstallationSpend(params)).resolves.toMatchObject({
      creditMicros: 4_200_000,
      runCount: 3,
      capCreditMicros: 5_000_000,
      state: "near",
    });
  });

  it("lets an uncapped routine run without reading spend", async () => {
    getTemplateById.mockResolvedValue(installationRecord({}));

    await expect(assertRecipeInstallationWithinBudget(params)).resolves.toBeUndefined();
    expect(summariseRunSpend).not.toHaveBeenCalled();
  });

  it("pauses a routine that has reached its cap and refuses the run", async () => {
    getTemplateById.mockResolvedValue(installationRecord({ monthlyCreditCapMicros: 5_000_000 }));
    summariseRunSpend.mockResolvedValue({ credit_micros: 5_000_000, cost_micros: 0, run_count: 9 });

    await expect(assertRecipeInstallationWithinBudget(params)).rejects.toThrow(/monthly budget/);
    expect(updateTemplate).toHaveBeenCalledWith("installation-1", {
      configuration: expect.objectContaining({ status: "paused", pausedReason: "budget" }),
      status: "paused",
    });
    expect(mocks.syncRecipeComposioTriggerStatus).toHaveBeenCalledWith(
      expect.objectContaining({ installationId: "installation-1", enabled: false }),
    );
  });
});
