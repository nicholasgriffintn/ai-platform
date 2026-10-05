import {
  createDeploymentRequestSchema,
  type ModelPlatformAction,
} from "@ngriffin_uk/polychat-schemas";
import { Miniflare } from "miniflare";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { createServiceContext, type ServiceContext } from "~/infrastructure/context/serviceContext";
import { requireModelAction, badRequest } from "~/modules/model-registry/application/access";
import { TaskService } from "~/modules/tasks/application/TaskService";

import {
  testModelAlias,
  testModelDeployment,
  testModelRoute,
} from "../../../../../test/fixtures/model-platform";
import { databaseTestEnvironment } from "../../../../../test/helpers/environment";
import { createAliasForRoute } from "../aliases";
import { createDeployment, startPreparedDeployment } from "../deployments";
import { createRoute } from "../routes";

vi.mock("~/modules/model-registry/application/access", async (importOriginal) => ({
  ...(await importOriginal<typeof import("~/modules/model-registry/application/access")>()),
  requireModelAction: vi.fn(),
}));
vi.mock("../aliases", () => ({ createAliasForRoute: vi.fn() }));

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
  vi.mocked(requireModelAction).mockResolvedValue({
    userId: 1,
    role: "admin",
    actions: new Set<ModelPlatformAction>(["deploy", "promote"]),
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
  vi.spyOn(context.repositories.modelDeployments, "list").mockResolvedValue([]);
  vi.spyOn(context.repositories.modelDeployments, "create").mockResolvedValue(testModelDeployment);
  vi.spyOn(context.repositories.modelDeployments, "update").mockResolvedValue(undefined);
  vi.spyOn(context.repositories.modelRoutes, "createRoute").mockResolvedValue(testModelRoute);
  vi.spyOn(context.repositories.audit, "createRecord").mockResolvedValue(undefined);
  vi.spyOn(TaskService.prototype, "enqueueTask").mockResolvedValue("sync-task");
  vi.mocked(createAliasForRoute).mockResolvedValue(testModelAlias);
});

describe("deployment registration boundaries", () => {
  it("reserves an empty alias without publishing an unreviewed deployment", async () => {
    const request = createDeploymentRequestSchema.parse({
      name: "test",
      aliasName: "production",
      spec: testModelDeployment.spec,
    });

    await startPreparedDeployment(context.env, context.repositories, "workspace", 1, {
      request,
      projectId: null,
      baseVersionId: "version",
      adapterVersionIds: [],
      jurisdiction: "eu",
      regionId: "eu",
      weightsVerified: true,
      retention: "provider",
      estimateUsd: 100,
    });

    expect(vi.mocked(createAliasForRoute).mock.calls[0]?.[1]).toMatchObject({
      name: "production",
      routeId: null,
    });
  });

  it("requires promotion rights before creating a deployment with an alias", async () => {
    const access = await requireModelAction(context, "workspace", "deploy");

    vi.mocked(requireModelAction)
      .mockClear()
      .mockResolvedValueOnce(access)
      .mockRejectedValueOnce(badRequest("promotion denied"));
    await expect(
      createDeployment(context, "workspace", {
        name: "test",
        aliasName: "production",
        spec: testModelDeployment.spec,
      }),
    ).rejects.toThrow("promotion denied");
    expect(context.repositories.modelDeployments.create).not.toHaveBeenCalled();
  });

  it.each(["alias:foreign", "deployment:foreign"])(
    "does not register a platform reference as a catalogue route: %s",
    async (providerModelId) => {
      await expect(
        createRoute(context, "workspace", {
          providerModelId,
          provider: "polychat-deployment",
          versionId: "version",
          region: "eu",
          weightsVerified: true,
        }),
      ).rejects.toMatchObject({ statusCode: 400 });
      expect(context.repositories.modelRoutes.createRoute).not.toHaveBeenCalled();
    },
  );
});
