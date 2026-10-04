import {
  modelVersionAttributesSchema,
  type ModelPlatformAction,
} from "@ngriffin_uk/polychat-schemas";
import { Miniflare } from "miniflare";
import { afterAll, beforeAll, expect, it, vi } from "vitest";

import { createServiceContext, type ServiceContext } from "~/infrastructure/context/serviceContext";
import { revokeVersion } from "~/modules/model-governance/application/revocation";

import { databaseTestEnvironment } from "../../../../../test/environment";
import { initialiseModelPlatformDatabase } from "../../../../../test/model-platform-database";
import { requireModelAction } from "../access";
import { requestDecision, resolveDecision } from "../decisions";
import { loadRegistryScope, routeStanding, versionStanding } from "../scope";

vi.mock("../access", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../access")>()),
  requireModelAction: vi.fn(),
}));
const runtime = new Miniflare({
  modules: true,
  script: "export default { fetch() { return new Response('test'); } }",
  compatibilityDate: "2026-08-01",
  d1Databases: ["DB"],
});
let context: ServiceContext;
let versionId: string;

beforeAll(async () => {
  const database = await runtime.getD1Database("DB");

  await initialiseModelPlatformDatabase(database);
  context = createServiceContext({ env: databaseTestEnvironment(database) });
  vi.mocked(requireModelAction).mockResolvedValue({
    userId: 1,
    role: "admin",
    actions: new Set<ModelPlatformAction>(["approve"]),
    separationOfDuties: false,
    workspace: {
      id: "workspace",
      name: "Workspace",
      description: "",
      colour: "#000000",
      created_by: 1,
      created_at: "2026-09-26T00:00:00Z",
      updated_at: null,
    },
  });
  vi.spyOn(context.repositories.audit, "createRecord").mockResolvedValue(undefined);
  await context.repositories.modelGovernance.savePolicy({
    workspaceId: "workspace",
    projectId: null,
    rules: [],
    hash: "empty",
    enforcement: "enforced",
    updatedBy: 1,
  });
  const asset = await context.repositories.modelAssets.createAsset({
    workspaceId: "workspace",
    kind: "model",
    source: "upload",
    sourceRef: "upload/model",
    displayName: "Model",
    createdBy: 2,
  });
  const version = await context.repositories.modelAssets.createVersion({
    workspaceId: "workspace",
    assetId: asset.id,
    revision: "revision",
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
    createdBy: 2,
  });

  versionId = version.id;
});
afterAll(() => runtime.dispose());

it("keeps route revocation effective under an allow policy until a person approves it again", async () => {
  const repositories = context.repositories;
  const route = await repositories.modelRoutes.createRoute({
    workspaceId: "workspace",
    versionId,
    provider: "together-ai",
    providerModelId: "model",
    region: "eu",
    weightsVerified: true,
    createdBy: 1,
  });
  const decision = await repositories.modelGovernance.createDecision({
    workspaceId: "workspace",
    projectId: null,
    versionId,
    routeId: route.id,
    state: "approved",
    verdict: { effect: "allow", matches: [], policyHashes: [] },
    evidenceIds: [],
    isException: false,
    note: null,
    requestedBy: 2,
  });

  await resolveDecision(context, "workspace", decision.id, { state: "revoked" });
  let scope = await loadRegistryScope(repositories, "workspace", null, { versionIds: [versionId] });

  expect(routeStanding(scope, route)?.usable).toBe(false);
  expect(versionStanding(scope, scope.versions[0])?.usable).toBe(true);
  const request = await requestDecision(context, "workspace", {
    versionId,
    routeId: route.id,
    projectId: null,
    exception: false,
  });

  expect(request.state).toBe("pending");
  await resolveDecision(context, "workspace", request.id, { state: "rejected" });
  scope = await loadRegistryScope(repositories, "workspace", null, { versionIds: [versionId] });
  expect(routeStanding(scope, route)?.usable).toBe(false);
  const retry = await requestDecision(context, "workspace", {
    versionId,
    routeId: route.id,
    projectId: null,
    exception: false,
  });

  await resolveDecision(context, "workspace", retry.id, { state: "approved" });
  scope = await loadRegistryScope(repositories, "workspace", null, { versionIds: [versionId] });
  expect(routeStanding(scope, route)?.usable).toBe(true);
});

it("records version withdrawal even when there was never a version approval to revoke", async () => {
  await revokeVersion(context, "workspace", versionId, { reason: "Withdraw the model" });
  const scope = await loadRegistryScope(context.repositories, "workspace", null, {
    versionIds: [versionId],
  });

  expect(versionStanding(scope, scope.versions[0])?.usable).toBe(false);
  const request = await requestDecision(context, "workspace", {
    versionId,
    projectId: null,
    exception: false,
  });

  expect(request.state).toBe("pending");
});
