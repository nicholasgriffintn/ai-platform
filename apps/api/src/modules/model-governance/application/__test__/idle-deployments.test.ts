import { Miniflare } from "miniflare";
import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";

import { createServiceContext, type ServiceContext } from "~/infrastructure/context/serviceContext";
import {
  applyDeploymentState,
  enqueueDeploymentSync,
} from "~/modules/model-serving/application/deployments";

import { databaseTestEnvironment } from "../../../../../test/environment";
import { testModelDeployment } from "../../../../../test/model-platform";
import { reconcileModelPlatform } from "../maintenance";
import { getWorkspaceSpendLines } from "../spend";

vi.mock("~/modules/model-serving/application/deployments", () => ({
  applyDeploymentState: vi.fn(),
  enqueueDeploymentSync: vi.fn(),
}));
vi.mock("../spend", () => ({ getWorkspaceSpendLines: vi.fn() }));

const runtime = new Miniflare({
  modules: true,
  script: "export default { fetch() { return new Response('test'); } }",
  compatibilityDate: "2026-08-01",
  d1Databases: ["DB"],
});
let context: ServiceContext;

beforeAll(async () => {
  context = createServiceContext({
    env: databaseTestEnvironment(await runtime.getD1Database("DB")),
  });
});
afterAll(() => runtime.dispose());
beforeEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
  const now = new Date().toISOString();

  vi.spyOn(context.repositories.modelDeployments, "list").mockResolvedValue([
    {
      ...testModelDeployment,
      updated_at: now,
      last_checked_at: now,
      created_at: "2020-01-01T00:00:00Z",
      spec: {
        ...testModelDeployment.spec,
        scaling: { ...testModelDeployment.spec.scaling, minReplicas: 1 },
      },
    },
  ]);
  vi.spyOn(context.repositories.modelTraining, "list").mockResolvedValue([]);
  vi.spyOn(context.repositories.modelSpend, "listBudgets").mockResolvedValue([
    {
      id: "budget",
      workspace_id: "workspace",
      project_id: null,
      scope_key: "workspace",
      monthly_limit_usd: 100,
      soft_limit_percent: 80,
      hard_stop: true,
      approval_above_usd: null,
      idle_pause_minutes: 60,
      updated_by: 1,
      updated_at: now,
    },
  ]);
  vi.spyOn(context.repositories.usageEvents, "lastModelUseAt").mockResolvedValue(null);
  vi.spyOn(context.repositories.audit, "lastActionAt").mockResolvedValue(null);
  vi.mocked(getWorkspaceSpendLines).mockResolvedValue([]);
  vi.mocked(applyDeploymentState).mockResolvedValue(testModelDeployment);
});

it("pauses a never-used deployment even when provider polling just updated it", async () => {
  await expect(
    reconcileModelPlatform(context.env, context.repositories, "workspace"),
  ).resolves.toEqual({ paused: 1, resynced: 0 });
  expect(applyDeploymentState).toHaveBeenCalledOnce();
});

it.each(["usage", "resume"])("grants a fresh idle interval after recent %s", async (activity) => {
  const now = new Date().toISOString();

  if (activity === "usage") {
    vi.mocked(context.repositories.usageEvents.lastModelUseAt).mockResolvedValue(now);
  } else {
    vi.mocked(context.repositories.audit.lastActionAt).mockResolvedValue(now);
  }

  await expect(
    reconcileModelPlatform(context.env, context.repositories, "workspace"),
  ).resolves.toEqual({ paused: 0, resynced: 0 });
  expect(applyDeploymentState).not.toHaveBeenCalled();
  expect(enqueueDeploymentSync).not.toHaveBeenCalled();
});
