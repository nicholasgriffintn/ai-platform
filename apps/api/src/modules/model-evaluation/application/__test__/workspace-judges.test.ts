import { Miniflare } from "miniflare";
import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";

import { RepositoryManager } from "~/infrastructure/database/repositoryManager";
import { loadRegistryScope, routeStanding } from "~/modules/model-registry/application/scope";
import { invokeDeployment } from "~/modules/model-serving/application/invocation";
import { databaseTestEnvironment } from "~/test-utils/environment";
import {
  testModelAlias,
  testModelDeployment,
  testModelRoute,
  testRegistryScope,
} from "~/test-utils/model-platform";
import type { IEnv } from "~/types";

import { scoreWithGrader } from "../graders";

vi.mock("~/modules/model-registry/application/scope", async (importOriginal) => ({
  ...(await importOriginal<typeof import("~/modules/model-registry/application/scope")>()),
  loadRegistryScope: vi.fn(),
  routeStanding: vi.fn(),
}));
vi.mock("~/modules/model-serving/application/invocation", () => ({ invokeDeployment: vi.fn() }));
const runtime = new Miniflare({
  modules: true,
  script: "export default { fetch() { return new Response('test'); } }",
  compatibilityDate: "2026-08-01",
  d1Databases: ["DB"],
});
let repositories: RepositoryManager;
let env: IEnv;

beforeAll(async () => {
  env = databaseTestEnvironment(await runtime.getD1Database("DB"));
  repositories = new RepositoryManager(env);
});
afterAll(() => runtime.dispose());
beforeEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
  vi.spyOn(repositories.modelAliases, "get").mockResolvedValue({
    ...testModelAlias,
    route_id: testModelRoute.id,
  });
  vi.spyOn(repositories.modelRoutes, "getRoute").mockResolvedValue(testModelRoute);
  vi.spyOn(repositories.modelDeployments, "get").mockResolvedValue(testModelDeployment);
  vi.mocked(loadRegistryScope).mockResolvedValue(testRegistryScope);
  vi.mocked(routeStanding).mockReturnValue({
    usable: true,
    decision: null,
    verdict: { effect: "allow", matches: [], policyHashes: [] },
  });
  vi.mocked(invokeDeployment).mockResolvedValue({
    text: '{"score": 4}',
    inputTokens: 1,
    outputTokens: 1,
  });
});

it.each(["alias:alias-id", "deployment:deployment-id"])(
  "scores with an approved workspace judge %s",
  async (model) => {
    const score = await scoreWithGrader(
      { env, repositories, workspaceId: "workspace", projectId: null },
      { kind: "judge", rubric: "Score relevance", judgeModelId: model },
      { input: "Question", output: "Answer" },
    );

    expect(score).toBe(0.75);
    expect(invokeDeployment).toHaveBeenCalledOnce();
  },
);

it("rejects a judge in another project without invoking it", async () => {
  vi.mocked(repositories.modelAliases.get).mockResolvedValue({
    ...testModelAlias,
    route_id: testModelRoute.id,
    project_id: "foreign",
  });
  await expect(
    scoreWithGrader(
      { env, repositories, workspaceId: "workspace", projectId: "project" },
      { kind: "judge", rubric: "Score relevance", judgeModelId: "alias:alias-id" },
      { input: "Question", output: "Answer" },
    ),
  ).rejects.toMatchObject({ statusCode: 404 });
  expect(invokeDeployment).not.toHaveBeenCalled();
});

it("rejects a judge whose route loses approval", async () => {
  vi.mocked(routeStanding).mockReturnValue({
    usable: false,
    decision: null,
    verdict: { effect: "block", matches: [], policyHashes: [] },
  });
  await expect(
    scoreWithGrader(
      { env, repositories, workspaceId: "workspace", projectId: null },
      { kind: "judge", rubric: "Score relevance", judgeModelId: "alias:alias-id" },
      { input: "Question", output: "Answer" },
    ),
  ).rejects.toMatchObject({ statusCode: 409 });
  expect(invokeDeployment).not.toHaveBeenCalled();
});
