import { hostManifest } from "@ngriffin_uk/polychat-ai-model-providers";
import {
  modelVersionAttributesSchema,
  type ModelPlatformAction,
} from "@ngriffin_uk/polychat-schemas";
import { Miniflare } from "miniflare";
import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";

import { createServiceContext, type ServiceContext } from "~/infrastructure/context/serviceContext";
import { requireHostingBudgetCompatibility } from "~/modules/model-governance/application/hosting-budgets";
import { resolveSpendRequest } from "~/modules/model-governance/application/spend-execution";
import { requireModelAction } from "~/modules/model-registry/application/access";
import { TaskService } from "~/modules/tasks/application/TaskService";
import { databaseTestEnvironment } from "~/test-utils/environment";
import { testModelDeployment } from "~/test-utils/model-platform";
import { initialiseModelPlatformDatabase } from "~/test-utils/model-platform-database";

import { changeDeploymentState, scaleDeployment } from "../deployments";
import { runHostAction } from "../invocation";

vi.mock("~/modules/model-registry/application/access", async (importOriginal) => ({
  ...(await importOriginal<typeof import("~/modules/model-registry/application/access")>()),
  requireModelAction: vi.fn(),
}));
vi.mock("../invocation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../invocation")>()),
  runHostAction: vi.fn(),
}));
const runtime = new Miniflare({
  modules: true,
  script: "export default { fetch() { return new Response('test'); } }",
  compatibilityDate: "2026-08-01",
  d1Databases: ["DB"],
});
let context: ServiceContext;
let versionId: string;
let deploymentId: string;
const access = {
  userId: 1,
  role: "admin" as const,
  actions: new Set<ModelPlatformAction>(["deploy", "approve"]),
  separationOfDuties: true,
  workspace: {
    id: "workspace",
    name: "Workspace",
    description: "",
    colour: "#000000",
    created_by: 1,
    created_at: "2026-09-26T00:00:00Z",
    updated_at: null,
  },
};

beforeAll(async () => {
  const database = await runtime.getD1Database("DB");

  await initialiseModelPlatformDatabase(database);
  context = createServiceContext({ env: databaseTestEnvironment(database) });
  await context.repositories.modelGovernance.savePolicy({
    workspaceId: "workspace",
    projectId: null,
    rules: [],
    hash: "allow",
    enforcement: "enforced",
    updatedBy: 1,
  });
  const asset = await context.repositories.modelAssets.createAsset({
    workspaceId: "workspace",
    kind: "model",
    source: "huggingface",
    sourceRef: "org/base",
    displayName: "Base",
    createdBy: 1,
  });
  const version = await context.repositories.modelAssets.createVersion({
    workspaceId: "workspace",
    assetId: asset.id,
    revision: "a".repeat(40),
    status: "ready",
    attributes: modelVersionAttributesSchema.parse({
      licence: "apache-2.0",
      formats: [],
      parameterCount: null,
      gated: false,
      remoteCode: false,
      pipelineTag: null,
      libraryName: null,
      tags: [],
      baseModels: [],
      totalBytes: 0,
      trainingComputeFlops: null,
      architecture: null,
      location: null,
    }),
    files: [],
    createdBy: 1,
  });

  versionId = version.id;
});
afterAll(() => runtime.dispose());
beforeEach(async () => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
  vi.mocked(requireModelAction).mockResolvedValue(access);
  vi.spyOn(context.repositories.audit, "createRecord").mockResolvedValue(undefined);
  vi.spyOn(TaskService.prototype, "enqueueTask").mockResolvedValue("sync");
  vi.mocked(runHostAction).mockImplementation(async (_repositories, deployment) => ({
    ...deployment,
    status: "running",
  }));
  await context.repositories.modelSpend.saveBudget({
    workspaceId: "workspace",
    projectId: null,
    monthlyLimitUsd: 100000,
    softLimitPercent: 80,
    hardStop: true,
    approvalAboveUsd: 5,
    idlePauseMinutes: null,
    updatedBy: 1,
  });
  const deployment = await context.repositories.modelDeployments.create({
    workspaceId: "workspace",
    projectId: null,
    name: crypto.randomUUID(),
    versionId,
    spec: {
      ...testModelDeployment.spec,
      versionId,
      target: {
        ...testModelDeployment.spec.target,
        target: "huggingface-endpoints",
        hardware: "nvidia-l4:x1",
      },
      scaling: { ...testModelDeployment.spec.scaling, minReplicas: 1, maxReplicas: 1 },
    },
    specHash: "original",
    provider: "huggingface",
    host: "huggingface-endpoints",
    jurisdiction: "eu",
    weightsVerified: true,
    createdBy: 1,
  });

  deploymentId = deployment.id;
  await context.repositories.modelDeployments.update(deploymentId, {
    status: "paused",
    desired_state: "paused",
    provider_ref: "endpoint",
    hourly_usd: 1,
  });
});

it("holds resume for a separate spend approver, then resumes the same deployment", async () => {
  const pending = await changeDeploymentState(context, "workspace", deploymentId, "resume");

  expect(pending.spendRequestId).toBeTruthy();
  expect(runHostAction).not.toHaveBeenCalled();
  await expect(
    resolveSpendRequest(context, "workspace", pending.spendRequestId ?? "", { state: "approved" }),
  ).rejects.toMatchObject({ statusCode: 403 });
  vi.mocked(requireModelAction).mockResolvedValue({ ...access, userId: 2 });
  const approved = await resolveSpendRequest(context, "workspace", pending.spendRequestId ?? "", {
    state: "approved",
  });

  expect(approved).toMatchObject({ state: "approved", subjectId: deploymentId });
  expect(runHostAction).toHaveBeenCalledOnce();
});

it("blocks resume and scaling that would exceed a hard budget", async () => {
  await context.repositories.modelSpend.saveBudget({
    workspaceId: "workspace",
    projectId: null,
    monthlyLimitUsd: 1,
    softLimitPercent: 80,
    hardStop: true,
    approvalAboveUsd: null,
    idlePauseMinutes: null,
    updatedBy: 1,
  });
  await expect(
    changeDeploymentState(context, "workspace", deploymentId, "resume"),
  ).rejects.toMatchObject({ statusCode: 409 });
  await expect(
    scaleDeployment(context, "workspace", deploymentId, { minReplicas: 2, maxReplicas: 2 }),
  ).rejects.toMatchObject({ statusCode: 409 });
  expect(runHostAction).not.toHaveBeenCalled();
});

it("rechecks the budget when a pending resume is approved", async () => {
  const pending = await changeDeploymentState(context, "workspace", deploymentId, "resume");

  await context.repositories.modelSpend.saveBudget({
    workspaceId: "workspace",
    projectId: null,
    monthlyLimitUsd: 1,
    softLimitPercent: 80,
    hardStop: true,
    approvalAboveUsd: 5,
    idlePauseMinutes: null,
    updatedBy: 1,
  });
  vi.mocked(requireModelAction).mockResolvedValue({ ...access, userId: 2 });
  await expect(
    resolveSpendRequest(context, "workspace", pending.spendRequestId ?? "", { state: "approved" }),
  ).rejects.toMatchObject({ statusCode: 409 });
  expect(runHostAction).not.toHaveBeenCalled();
});

it("rejects pause-based budgets on hosts without pause support", async () => {
  const host = hostManifest("google-vertex", "vertex");

  await expect(
    requireHostingBudgetCompatibility(context.repositories, "workspace", null, host),
  ).rejects.toMatchObject({ statusCode: 409 });
  await context.repositories.modelSpend.saveBudget({
    workspaceId: "workspace",
    projectId: null,
    monthlyLimitUsd: 100000,
    softLimitPercent: 80,
    hardStop: false,
    approvalAboveUsd: null,
    idlePauseMinutes: null,
    updatedBy: 1,
  });
  await expect(
    requireHostingBudgetCompatibility(context.repositories, "workspace", null, host),
  ).resolves.toBeUndefined();
});

it("does not wake a paused deployment when its future scale is reduced", async () => {
  const result = await scaleDeployment(context, "workspace", deploymentId, {
    minReplicas: 0,
    maxReplicas: 1,
  });

  expect(result.status).toBe("paused");
  expect(result.spec.scaling.minReplicas).toBe(0);
  expect(runHostAction).not.toHaveBeenCalled();
});

it("rejects an approved scale request after the deployment configuration changes", async () => {
  const pending = await scaleDeployment(context, "workspace", deploymentId, {
    minReplicas: 2,
    maxReplicas: 2,
  });

  expect(pending.spendRequestId).toBeTruthy();
  await context.repositories.modelDeployments.update(deploymentId, { spec_hash: "changed" });
  vi.mocked(requireModelAction).mockResolvedValue({ ...access, userId: 2 });
  await expect(
    resolveSpendRequest(context, "workspace", pending.spendRequestId ?? "", { state: "approved" }),
  ).rejects.toMatchObject({ statusCode: 409 });
  expect(runHostAction).not.toHaveBeenCalled();
});
