import type { ModelPlatformAction } from "@ngriffin_uk/polychat-schemas";
import { Miniflare } from "miniflare";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { createServiceContext, type ServiceContext } from "~/infrastructure/context/serviceContext";
import { requireModelAction } from "~/modules/model-registry/application/access";
import {
  loadRegistryScope,
  routeStanding,
  type RegistryScope,
} from "~/modules/model-registry/application/scope";
import type { ModelRouteRecord } from "~/modules/model-registry/infrastructure/ModelRouteRepository";

import { databaseTestEnvironment } from "../../../../../test/environment";
import type {
  ModelAliasEventRecord,
  ModelAliasRecord,
} from "../../infrastructure/ModelAliasRepository";
import { createAlias, promoteAlias, rollbackAlias, updateAlias } from "../aliases";

vi.mock("~/modules/model-registry/application/access", async (importOriginal) => ({
  ...(await importOriginal<typeof import("~/modules/model-registry/application/access")>()),
  requireModelAction: vi.fn(),
}));
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

const route: ModelRouteRecord = {
  id: "route-next",
  workspace_id: "workspace",
  version_id: "version",
  provider: "test",
  provider_model_id: "test-model",
  region: "eu",
  weights_verified: true,
  status: "active",
  deployment_id: null,
  jurisdiction: "eu",
  retention: "provider",
  created_by: 1,
  created_at: "2026-09-26T00:00:00Z",
};
const scope: RegistryScope = {
  workspaceId: "workspace",
  projectId: null,
  assets: new Map(),
  versions: [],
  evidence: [],
  decisions: [],
  routes: [route],
  datasets: new Map(),
  stack: {
    project: null,
    scoped: [],
    workspace: {
      id: "policy",
      workspaceId: "workspace",
      projectId: null,
      rules: [],
      revision: 1,
      hash: "hash",
      enforcement: "enforced",
      updatedAt: "2026-09-26T00:00:00Z",
      updatedBy: 1,
      isDefault: false,
    },
  },
};
let context: ServiceContext;
let alias: ModelAliasRecord;
let events: ModelAliasEventRecord[];
let actions: Set<ModelPlatformAction>;
let separationOfDuties: boolean;
let actorId: number;

beforeAll(async () => {
  context = createServiceContext({
    env: databaseTestEnvironment(await runtime.getD1Database("DB")),
  });
});
afterAll(() => runtime.dispose());

beforeEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
  actions = new Set<ModelPlatformAction>(["view", "promote", "approve", "manage_policy"]);
  separationOfDuties = false;
  actorId = 1;
  alias = {
    id: "alias-id",
    workspace_id: "workspace",
    project_id: null,
    scope_key: "workspace",
    name: "production",
    description: null,
    route_id: "route-current",
    canary_route_id: null,
    canary_percent: 0,
    gate: null,
    requires_approval: false,
    updated_by: 1,
    updated_at: "2026-09-26T00:00:00Z",
    created_at: "2026-09-26T00:00:00Z",
  };
  events = [];
  vi.mocked(requireModelAction).mockImplementation(async () => ({
    userId: actorId,
    role: "admin",
    actions,
    separationOfDuties,
    workspace: {
      id: "workspace",
      name: "Workspace",
      description: "",
      colour: "#000000",
      created_by: 1,
      created_at: "2026-09-26T00:00:00Z",
      updated_at: null,
    },
  }));
  vi.mocked(loadRegistryScope).mockResolvedValue(scope);
  vi.mocked(routeStanding).mockReturnValue({
    usable: true,
    decision: null,
    verdict: { effect: "allow", matches: [], policyHashes: [] },
  });
  const repositories = context.repositories;

  vi.spyOn(repositories.modelRoutes, "getRoute").mockImplementation(async (_workspaceId, id) => ({
    ...route,
    id,
  }));
  vi.spyOn(repositories.modelAliases, "get").mockImplementation(async () => alias);
  vi.spyOn(repositories.modelAliases, "list").mockResolvedValue([]);
  vi.spyOn(repositories.modelAliases, "listEvents").mockImplementation(async () => events);
  vi.spyOn(repositories.modelAliases, "create").mockImplementation(async (input) => ({
    ...alias,
    route_id: input.routeId,
  }));
  vi.spyOn(repositories.modelAliases, "update").mockImplementation(async (_id, changes) => {
    alias = { ...alias, ...changes };

    return alias;
  });
  vi.spyOn(repositories.modelAliases, "addEvent").mockImplementation(async (input) => {
    const event: ModelAliasEventRecord = {
      id: `event-${events.length}`,
      alias_id: input.aliasId,
      kind: input.kind,
      from_route_id: input.fromRouteId,
      to_route_id: input.toRouteId,
      reason: input.reason,
      gate: input.gate,
      actor_user_id: input.actorUserId,
      created_at: new Date().toISOString(),
    };

    events.unshift(event);

    return event;
  });
  vi.spyOn(repositories.modelEvals, "getSuite").mockResolvedValue(null);
  vi.spyOn(repositories.modelEvals, "latestCompletedRun").mockResolvedValue(null);
  vi.spyOn(repositories.audit, "createRecord").mockResolvedValue(undefined);
});

describe("alias governance transitions", () => {
  it("allows an approved initial target when no separate approval is required", async () => {
    expect(
      await createAlias(context, "workspace", { name: "production", routeId: route.id }),
    ).toMatchObject({ routeId: route.id });
  });

  it("lets another approver complete a requested promotion", async () => {
    separationOfDuties = true;
    expect(
      (await promoteAlias(context, "workspace", alias.id, { routeId: route.id })).outcome,
    ).toBe("awaiting_approval");
    actorId = 2;
    const result = await promoteAlias(context, "workspace", alias.id, { routeId: route.id });

    expect(result.outcome).toBe("promoted");
    expect(result.alias.routeId).toBe(route.id);
  });

  it("checks the evaluation gate before installing an initial target", async () => {
    vi.mocked(context.repositories.modelEvals.getSuite).mockResolvedValue({
      id: "suite",
      workspace_id: "workspace",
      project_id: null,
      name: "Gate",
      description: null,
      system_prompt: null,
      cases: [],
      grader_ids: [],
      replay_sample_size: 1,
      created_by: 1,
      created_at: "2026-09-26T00:00:00Z",
      updated_at: "2026-09-26T00:00:00Z",
    });
    await expect(
      createAlias(context, "workspace", {
        name: "production",
        routeId: route.id,
        gate: { suiteId: "suite", thresholds: { accuracy: 0.9 } },
      }),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(context.repositories.modelAliases.create).not.toHaveBeenCalled();
  });

  it("does not use rollback to skip alias approval", async () => {
    actions.delete("approve");
    alias.requires_approval = true;
    await expect(rollbackAlias(context, "workspace", alias.id)).rejects.toMatchObject({
      statusCode: 409,
    });
    expect(context.repositories.modelAliases.update).not.toHaveBeenCalled();
  });

  it("rejects an initial target that is not approved for the alias scope", async () => {
    vi.mocked(routeStanding).mockReturnValue(null);
    await expect(
      createAlias(context, "workspace", { name: "production", routeId: route.id }),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(context.repositories.modelAliases.create).not.toHaveBeenCalled();
  });

  it("requires a separate promotion when the initial alias needs approval", async () => {
    actions.delete("approve");
    await expect(
      createAlias(context, "workspace", {
        name: "production",
        routeId: route.id,
        requiresApproval: true,
      }),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(context.repositories.modelAliases.create).not.toHaveBeenCalled();
  });

  it("revalidates an old route before rolling back", async () => {
    events.push({
      id: "previous",
      alias_id: alias.id,
      kind: "promoted",
      from_route_id: route.id,
      to_route_id: alias.route_id,
      reason: null,
      gate: null,
      actor_user_id: 2,
      created_at: "2026-09-25T00:00:00Z",
    });
    vi.mocked(routeStanding).mockReturnValue(null);
    await expect(rollbackAlias(context, "workspace", alias.id)).rejects.toMatchObject({
      statusCode: 409,
    });
    expect(context.repositories.modelAliases.update).not.toHaveBeenCalled();
  });

  it("applies workspace separation of duties even when an alias does not request approval", async () => {
    separationOfDuties = true;
    const result = await promoteAlias(context, "workspace", alias.id, { routeId: route.id });

    expect(result.outcome).toBe("awaiting_approval");
    expect(context.repositories.modelAliases.update).not.toHaveBeenCalled();
    await expect(
      promoteAlias(context, "workspace", alias.id, { routeId: route.id }),
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it("does not attach a gate suite from outside the workspace when editing an alias", async () => {
    await expect(
      updateAlias(context, "workspace", alias.id, {
        gate: { suiteId: "foreign-suite", thresholds: { accuracy: 0.9 } },
      }),
    ).rejects.toMatchObject({ statusCode: 404 });
    expect(context.repositories.modelAliases.update).not.toHaveBeenCalled();
  });
});
