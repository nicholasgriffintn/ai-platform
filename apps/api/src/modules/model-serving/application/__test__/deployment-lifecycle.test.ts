import { Miniflare } from "miniflare";
import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";

import { createServiceContext, type ServiceContext } from "~/infrastructure/context/serviceContext";
import { accrueDeploymentCost } from "~/modules/model-governance/application/spend";
import { TaskService } from "~/modules/tasks/application/TaskService";

import { databaseTestEnvironment } from "../../../../../test/environment";
import { testModelDeployment } from "../../../../../test/model-platform";
import { applyDeploymentState } from "../deployments";
import { hostFor } from "../invocation";
import { syncDeployment } from "../sync";

vi.mock("../invocation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../invocation")>()),
  hostFor: vi.fn(),
}));
vi.mock("~/modules/model-governance/application/spend", async (importOriginal) => ({
  ...(await importOriginal<typeof import("~/modules/model-governance/application/spend")>()),
  accrueDeploymentCost: vi.fn(),
}));

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
  vi.spyOn(context.repositories.modelDeployments, "update").mockResolvedValue(undefined);
  vi.spyOn(context.repositories.modelRoutes, "setStatus").mockResolvedValue(undefined);
  vi.spyOn(context.repositories.audit, "createRecord").mockResolvedValue(undefined);
  vi.spyOn(TaskService.prototype, "enqueueTask").mockResolvedValue("sync-task");
  vi.mocked(accrueDeploymentCost).mockResolvedValue("2026-09-27T00:00:00Z");
});

it.each(["paused", "deleted"] as const)(
  "does not provision a deployment whose desired state is %s",
  async (desired) => {
    vi.spyOn(context.repositories.modelDeployments, "getById").mockResolvedValue({
      ...testModelDeployment,
      status: "pending",
      provider_ref: null,
      desired_state: desired,
    });
    await expect(
      syncDeployment(context.repositories, testModelDeployment.id),
    ).resolves.toMatchObject({ status: "success" });
    expect(hostFor).not.toHaveBeenCalled();
    expect(context.repositories.modelDeployments.update).toHaveBeenCalledWith(
      testModelDeployment.id,
      expect.objectContaining({ status: desired }),
    );
  },
);

it("can resume a deployment paused before it was provisioned", async () => {
  const deployment = { ...testModelDeployment, provider_ref: null };
  const paused = await applyDeploymentState(
    context.env,
    context.repositories,
    deployment,
    "pause",
    { userId: 1, reason: null },
  );

  expect(paused.status).toBe("paused");
  expect(TaskService.prototype.enqueueTask).not.toHaveBeenCalled();
  const resumed = await applyDeploymentState(context.env, context.repositories, paused, "resume", {
    userId: 1,
    reason: null,
  });

  expect(resumed).toMatchObject({ desired_state: "running", status: "pending" });
  expect(TaskService.prototype.enqueueTask).toHaveBeenCalledOnce();
  expect(hostFor).not.toHaveBeenCalled();
});
