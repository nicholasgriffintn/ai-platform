import { Miniflare } from "miniflare";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { RepositoryManager } from "~/infrastructure/database/repositoryManager";
import { loadRegistryScope, routeStanding } from "~/modules/model-registry/application/scope";
import { databaseTestEnvironment } from "~/test-utils/environment";
import {
  testModelDeployment,
  testModelRoute,
  testRegistryScope,
} from "~/test-utils/model-platform";
import type { IEnv } from "~/types";

import { canUserInvokeDeployment, findPlatformChatModel } from "../chat-models";

vi.mock("~/modules/model-registry/application/scope", async (importOriginal) => ({
  ...(await importOriginal<typeof import("~/modules/model-registry/application/scope")>()),
  loadRegistryScope: vi.fn(),
  routeStanding: vi.fn(),
}));

const runtime = new Miniflare({
  modules: true,
  script: "export default { fetch() { return new Response('test'); } }",
  compatibilityDate: "2026-08-01",
  d1Databases: ["DB"],
});
let env: IEnv;
let repositories: RepositoryManager;

beforeAll(async () => {
  env = databaseTestEnvironment(await runtime.getD1Database("DB"));
  repositories = new RepositoryManager(env);
});
afterAll(() => runtime.dispose());
beforeEach(() => {
  vi.restoreAllMocks();
  vi.mocked(loadRegistryScope).mockResolvedValue(testRegistryScope);
  vi.mocked(routeStanding).mockReturnValue({
    usable: true,
    decision: null,
    verdict: { effect: "allow", matches: [], policyHashes: [] },
  });
  vi.spyOn(RepositoryManager, "getInstance").mockReturnValue(repositories);
  vi.spyOn(repositories.workspaces, "listWorkspaces").mockResolvedValue([
    {
      id: "workspace",
      name: "Workspace",
      description: "",
      colour: "#000000",
      created_by: 1,
      created_at: "2026-09-26T00:00:00Z",
      updated_at: null,
      role: "member",
      member_count: 1,
      project_count: 0,
    },
  ]);
  vi.spyOn(repositories.modelAliases, "getById").mockResolvedValue({
    id: "alias-id",
    workspace_id: "workspace",
    project_id: null,
    scope_key: "workspace",
    name: "Production",
    description: null,
    route_id: testModelRoute.id,
    canary_route_id: null,
    canary_percent: 0,
    gate: null,
    requires_approval: false,
    updated_by: 1,
    created_at: "2026-09-26T00:00:00Z",
    updated_at: "2026-09-26T00:00:00Z",
  });
  vi.spyOn(repositories.modelRoutes, "getRoute").mockResolvedValue(testModelRoute);
  vi.spyOn(repositories.modelDeployments, "getById").mockResolvedValue(testModelDeployment);
  vi.spyOn(repositories.modelDeployments, "get").mockResolvedValue(testModelDeployment);
});

describe("deployment model availability", () => {
  it("stops resolving an alias when its route loses approval", async () => {
    vi.mocked(routeStanding).mockReturnValue(null);
    expect(await findPlatformChatModel("alias:alias-id", env, 1)).toBeNull();
  });

  it("cannot resolve an alias target outside its workspace", async () => {
    vi.mocked(repositories.modelRoutes.getRoute).mockResolvedValue(null);
    expect(await findPlatformChatModel("alias:alias-id", env, 1)).toBeNull();
    expect(repositories.modelRoutes.getRoute).toHaveBeenCalledWith("workspace", testModelRoute.id);
  });
  it("identifies the concrete governed route when resolving an alias", async () => {
    expect(await findPlatformChatModel("alias:alias-id", env, 1)).toMatchObject({
      id: testModelRoute.provider_model_id,
      matchingModel: testModelRoute.provider_model_id,
    });
  });

  it("does not offer a deployment that has not become invocable", async () => {
    vi.mocked(repositories.modelDeployments.getById).mockResolvedValue({
      ...testModelDeployment,
      status: "provisioning",
    });
    vi.mocked(repositories.modelDeployments.get).mockResolvedValue({
      ...testModelDeployment,
      status: "provisioning",
    });
    expect(await findPlatformChatModel("alias:alias-id", env, 1)).toBeNull();
    expect(await findPlatformChatModel("deployment:deployment-id", env, 1)).toBeNull();
  });

  it("does not offer a deployment after a pause was requested", async () => {
    vi.mocked(repositories.modelDeployments.getById).mockResolvedValue({
      ...testModelDeployment,
      desired_state: "paused",
    });
    expect(await findPlatformChatModel("deployment:deployment-id", env, 1)).toBeNull();
  });
});

it("rejects direct deployment IDs when their current route loses approval", async () => {
  vi.mocked(routeStanding).mockReturnValue({
    usable: false,
    decision: null,
    verdict: { effect: "block", matches: [], policyHashes: [] },
  });
  vi.spyOn(repositories.workspaces, "getMembership").mockResolvedValue({ role: "member" });
  expect(await findPlatformChatModel("deployment:deployment-id", env, 1)).toBeNull();
  expect(await canUserInvokeDeployment(env, 1, "deployment-id")).toBeNull();
});
