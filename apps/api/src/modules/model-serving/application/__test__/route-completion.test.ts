import { Miniflare } from "miniflare";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { ai } from "~/infrastructure/ai";
import { RepositoryManager } from "~/infrastructure/database/repositoryManager";
import { invokeDeployment } from "~/modules/model-serving/application/invocation";
import { databaseTestEnvironment } from "~/test-utils/environment";
import {
  testModelRoute as route,
  testModelDeployment as deployment,
} from "~/test-utils/model-platform";
import type { IEnv } from "~/types";

import { completeWorkspaceRoute } from "../route-completion";

vi.mock("~/infrastructure/ai", () => ({ ai: { complete: vi.fn() } }));
vi.mock("~/modules/model-serving/application/invocation", () => ({ invokeDeployment: vi.fn() }));

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
  vi.clearAllMocks();
  vi.spyOn(repositories.modelDeployments, "get").mockResolvedValue(deployment);
  vi.mocked(invokeDeployment).mockResolvedValue({
    text: "Evaluation answer",
    inputTokens: 1,
    outputTokens: 2,
  });
});

describe("internal workspace completions", () => {
  it("invokes the exact workspace deployment without an anonymous chat request", async () => {
    await expect(
      completeWorkspaceRoute(env, repositories, route, "Question", "System prompt"),
    ).resolves.toBe("Evaluation answer");
    expect(repositories.modelDeployments.get).toHaveBeenCalledWith("workspace", "deployment-id");
    expect(vi.mocked(invokeDeployment).mock.calls).toHaveLength(1);
    const [usedRepositories, usedDeployment, request] = vi.mocked(invokeDeployment).mock.calls[0];

    expect(usedRepositories).toBe(repositories);
    expect(usedDeployment).toBe(deployment);
    expect(request.messages).toEqual([
      { role: "system", content: "System prompt" },
      { role: "user", content: "Question" },
    ]);
    expect(ai.complete).not.toHaveBeenCalled();
  });

  it("rejects missing or mismatched deployment routes before invoking a provider", async () => {
    vi.mocked(repositories.modelDeployments.get)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ ...deployment, route_id: "other-route" });
    await expect(
      completeWorkspaceRoute(env, repositories, route, "Question", null),
    ).rejects.toMatchObject({ statusCode: 404 });
    await expect(
      completeWorkspaceRoute(env, repositories, route, "Question", null),
    ).rejects.toMatchObject({ statusCode: 404 });
    expect(invokeDeployment).not.toHaveBeenCalled();
  });
});
