import { Miniflare } from "miniflare";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { createServiceContext, type ServiceContext } from "~/infrastructure/context/serviceContext";

import { browserTestUser } from "../../../../../test/computer-use";
import { databaseTestEnvironment } from "../../../../../test/environment";
import { testSiteOutput } from "../../../../../test/sites/fixtures";

const authority = vi.hoisted(() => ({ capability: vi.fn(), project: vi.fn() }));

vi.mock("~/modules/workspaces/application/access", () => ({
  requireOptionalProjectCapabilityAccess: authority.capability,
  requireProjectAccess: authority.project,
}));

import { requireSiteIntegrationAccess } from "../integration-access";

const runtime = new Miniflare({
  modules: true,
  script: "export default { fetch() { return new Response('test'); } }",
  compatibilityDate: "2026-08-01",
  d1Databases: ["DB"],
  kvNamespaces: ["CACHE"],
});
let context: ServiceContext;

beforeAll(async () => {
  const env = databaseTestEnvironment(await runtime.getD1Database("DB"));

  Object.defineProperty(env, "CACHE", { value: await runtime.getKVNamespace("CACHE") });
  context = createServiceContext({ env, user: browserTestUser });
  vi.spyOn(context.repositories.outputs, "getOutput").mockResolvedValue(testSiteOutput);
  vi.spyOn(context.repositories.outputs, "getPersonalOutput").mockResolvedValue(testSiteOutput);
  vi.spyOn(context.repositories.outputs, "getProjectOutput").mockResolvedValue(null);
});
afterAll(() => runtime.dispose());
beforeEach(() => {
  vi.clearAllMocks();
  authority.capability.mockResolvedValue(undefined);
  authority.project.mockResolvedValue({ role: "member" });
  vi.mocked(context.repositories.outputs.getOutput).mockResolvedValue(testSiteOutput);
  vi.mocked(context.repositories.outputs.getPersonalOutput).mockResolvedValue(testSiteOutput);
  vi.mocked(context.repositories.outputs.getProjectOutput).mockResolvedValue(null);
});

describe("site integration authority", () => {
  it("denies another owner's personal app and an incorrect project scope", async () => {
    vi.mocked(context.repositories.outputs.getOutput).mockResolvedValue({
      ...testSiteOutput,
      created_by_user_id: 2,
    });
    await expect(
      requireSiteIntegrationAccess(context, "site", { expectedRevision: 1 }),
    ).rejects.toThrow("not found");
    vi.mocked(context.repositories.outputs.getOutput).mockResolvedValue(testSiteOutput);
    await expect(
      requireSiteIntegrationAccess(context, "site", {
        projectId: "wrong-project",
        expectedRevision: 1,
      }),
    ).rejects.toThrow("not found");
  });

  it("allows a project member to read records but requires author or admin for app changes", async () => {
    const output = { ...testSiteOutput, created_by_user_id: 2, project_id: "project" };

    vi.mocked(context.repositories.outputs.getOutput).mockResolvedValue(output);
    vi.mocked(context.repositories.outputs.getProjectOutput).mockResolvedValue(output);
    expect(
      (
        await requireSiteIntegrationAccess(context, "site", {
          projectId: "project",
          expectedRevision: 1,
        })
      ).id,
    ).toBe("site");
    await expect(
      requireSiteIntegrationAccess(
        context,
        "site",
        { projectId: "project", expectedRevision: 1 },
        true,
      ),
    ).rejects.toThrow("creator or a project admin");
    authority.project.mockResolvedValue({ role: "admin" });
    await expect(
      requireSiteIntegrationAccess(
        context,
        "site",
        { projectId: "project", expectedRevision: 1 },
        true,
      ),
    ).resolves.toMatchObject({ id: "site" });
  });

  it("rejects stale revisions and revalidates revoked project authority on the next request", async () => {
    await expect(
      requireSiteIntegrationAccess(context, "site", { expectedRevision: 2 }),
    ).rejects.toThrow("changed");
    const output = { ...testSiteOutput, project_id: "project" };

    vi.mocked(context.repositories.outputs.getOutput).mockResolvedValue(output);
    vi.mocked(context.repositories.outputs.getProjectOutput).mockResolvedValue(output);
    await requireSiteIntegrationAccess(context, "site", {
      projectId: "project",
      expectedRevision: 1,
    });
    authority.project.mockRejectedValue(new Error("Membership revoked"));
    await expect(
      requireSiteIntegrationAccess(context, "site", { projectId: "project", expectedRevision: 1 }),
    ).rejects.toThrow("revoked");
  });
});
