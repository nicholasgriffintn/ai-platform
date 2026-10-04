import { Miniflare } from "miniflare";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";

import { browserTestUser } from "../../../../../test/computer-use";
import {
  createSitesTestContext,
  resetSitesTestData,
  saveTestSite,
} from "../../../../../test/sites/database";
import { editSite } from "../edit";
import { requireSiteIntegrationAccess } from "../integration-access";
import { getSite } from "../records";
import { readSiteData } from "../runtime";

const runtime = new Miniflare({
  modules: true,
  script: "export default { fetch() { return new Response('test'); } }",
  compatibilityDate: "2026-08-01",
  d1Databases: ["DB"],
  kvNamespaces: ["CACHE"],
});
let context: ServiceContext;

beforeAll(async () => {
  context = await createSitesTestContext(runtime);
});
afterAll(() => runtime.dispose());
beforeEach(async () => {
  await resetSitesTestData(context);
});

describe("site integration authority", () => {
  it("denies another owner's personal app and an incorrect project scope", async () => {
    await saveTestSite(context, null, 2);
    await expect(
      requireSiteIntegrationAccess(context, "site", { expectedRevision: 1 }),
    ).rejects.toMatchObject({ statusCode: 404 });
    await expect(
      requireSiteIntegrationAccess(context, "site", { projectId: "project", expectedRevision: 1 }),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it("allows project reads but checks the current stored role for writes", async () => {
    await saveTestSite(context, "project", 2);
    const scope = { projectId: "project", expectedRevision: 1 };

    await expect(requireSiteIntegrationAccess(context, "site", scope)).resolves.toMatchObject({
      id: "site",
    });
    await expect(requireSiteIntegrationAccess(context, "site", scope, true)).rejects.toMatchObject({
      statusCode: 403,
    });
    await context.env.DB.prepare(
      "UPDATE workspace_member SET role = 'admin' WHERE user_id = 1",
    ).run();
    await expect(requireSiteIntegrationAccess(context, "site", scope, true)).resolves.toMatchObject(
      { id: "site" },
    );
  });

  it("rejects stale revisions, revoked membership and excluded capability on subsequent requests", async () => {
    await saveTestSite(context, "project");
    const scope = { projectId: "project", expectedRevision: 1 };

    await expect(
      requireSiteIntegrationAccess(context, "site", { ...scope, expectedRevision: 2 }),
    ).rejects.toMatchObject({ statusCode: 409 });
    await requireSiteIntegrationAccess(context, "site", scope);
    await context.env.DB.prepare("UPDATE project_capability SET excluded = 1").run();
    await expect(requireSiteIntegrationAccess(context, "site", scope)).rejects.toMatchObject({
      statusCode: 404,
    });
    await context.env.DB.prepare("UPDATE project_capability SET excluded = 0").run();
    await context.env.DB.prepare("DELETE FROM workspace_member WHERE user_id = 1").run();
    await expect(requireSiteIntegrationAccess(context, "site", scope)).rejects.toMatchObject({
      statusCode: 404,
    });
  });
  it("keeps inaccessible Sources out of the document and checks live Source changes", async () => {
    await saveTestSite(context);
    const foreign = await context.repositories.sources.createSource({
      createdByUserId: 2,
      kind: "text",
      title: "Private",
      content: '[{"title":"Private"}]',
    });
    const source = await context.repositories.sources.createSource({
      createdByUserId: 1,
      kind: "text",
      title: "Rows",
      content: '[{"title":"Available"}]',
    });
    const attach = (sourceId: string) =>
      editSite({
        context,
        user: browserTestUser,
        siteId: "site",
        request: {
          expectedRevision: 1,
          summary: "Connect rows",
          patches: [
            {
              op: "add",
              path: "/dataBindings",
              value: { rows: { kind: "source", sourceId, pageId: "home", statePath: "/rows" } },
            },
          ],
        },
      });

    await expect(attach(foreign.id)).rejects.toMatchObject({ statusCode: 404 });
    expect((await getSite({ context, userId: 1 }, "site")).revision).toBe(1);
    const site = await attach(source.id);

    expect(
      (await readSiteData(context, site.id, { expectedRevision: site.revision })).bindings.rows,
    ).toEqual([{ title: "Available" }]);
    expect(JSON.stringify(site.project)).not.toContain("Available");
    await context.repositories.sources.updateSource(source.id, { content: "invalid JSON" });
    await expect(
      readSiteData(context, site.id, { expectedRevision: site.revision }),
    ).rejects.toMatchObject({ statusCode: 400 });
    await context.repositories.sources.updateSource(source.id, { status: "failed" });
    await expect(
      readSiteData(context, site.id, { expectedRevision: site.revision }),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});
