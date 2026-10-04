import { siteConnectorSnapshotRequestSchema } from "@ngriffin_uk/polychat-schemas";
import { Miniflare } from "miniflare";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { closeComposioConnectorRun } from "~/modules/apps/application/connectors/composio-run";
import {
  discoverRecipeConnectorTools,
  executeRecipeConnectorOperation,
} from "~/modules/apps/application/connectors/operations";

import {
  createSitesTestContext,
  resetSitesTestData,
  saveTestSite,
} from "../../../../../test/sites/database";
import { testSite } from "../../../../../test/sites/fixtures";
import { getSite, updateSite } from "../records";

const remote = vi.hoisted(() => ({
  accounts: vi.fn(),
  create: vi.fn(),
  search: vi.fn(),
  execute: vi.fn(),
  remove: vi.fn(),
}));

vi.mock("@ngriffin_uk/polychat-ai-integrations", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@ngriffin_uk/polychat-ai-integrations")>()),
  listComposioConnectedAccounts: remote.accounts,
  createComposioToolSession: remote.create,
  searchComposioSessionTools: remote.search,
  executeComposioSessionTool: remote.execute,
  deleteComposioToolSession: remote.remove,
}));

import { snapshotSiteConnector } from "../connector-data";

const runtime = new Miniflare({
  modules: true,
  script: "export default { fetch() { return new Response('test'); } }",
  compatibilityDate: "2026-08-01",
  d1Databases: ["DB"],
  kvNamespaces: ["CACHE"],
});
let context: ServiceContext;
const request = siteConnectorSnapshotRequestSchema.parse({
  expectedRevision: 1,
  bindingId: "messages",
  pageId: "home",
  statePath: "/messages",
  provider: "gmail",
  operation: "GMAIL_FETCH_EMAILS",
  connectedAccountId: "chosen-account",
  resultPath: "/messages",
  fields: { title: "/subject" },
});
const account = {
  id: "chosen-account",
  userId: "polychat:test:user:1",
  toolkitSlug: "gmail",
  authConfigId: "ac_uRCWNPtnTpEw",
  status: "ACTIVE",
  createdAt: "2026-10-04",
  updatedAt: "2026-10-04",
  isDisabled: false,
};

beforeAll(async () => {
  context = await createSitesTestContext(runtime);
  context.env.COMPOSIO_API_KEY = "test-remote-api-key";
});
afterAll(() => runtime.dispose());
beforeEach(async () => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
  await resetSitesTestData(context);
  await saveTestSite(context);
  remote.accounts.mockResolvedValue([{ ...account, id: "other-account" }, account]);
  remote.create.mockResolvedValue("remote-session");
  remote.search.mockResolvedValue({
    sessionId: "remote-session",
    tools: [{ slug: "GMAIL_FETCH_EMAILS" }],
  });
  remote.execute.mockResolvedValue({
    data: { messages: [{ subject: "Review", token: "never-store" }] },
    logId: "log",
  });
  remote.remove.mockResolvedValue(undefined);
});

async function storedSources() {
  return context.repositories.sources.listPersonalSourceSummaries(1);
}

async function concurrentEdit(projectId?: string) {
  return updateSite({ context, userId: 1, projectId }, "site", {
    expectedRevision: 1,
    brief: testSite.brief,
    plan: testSite.plan,
    project: testSite.project,
    issues: [],
    turn: {
      id: "concurrent",
      role: "edit",
      prompt: "Concurrent edit",
      createdAt: testSite.createdAt,
    },
  });
}

describe("connector-backed site sources", () => {
  it("uses the chosen account and stores only projected provider data in a bound Source", async () => {
    const site = await snapshotSiteConnector(context, "site", {
      ...request,
      params: { query: "a1b2c3d4-1234-5678-9012-aabbccddee99" },
    });
    const binding = site.project.dataBindings?.messages;

    expect(binding?.kind).toBe("source");
    if (binding?.kind !== "source") {
      throw new Error("Expected Source binding");
    }

    const source = await context.repositories.sources.getSource(binding.sourceId);

    expect(source?.content).toBe('[{"title":"Review"}]');
    expect(site.revision).toBe(2);
    expect(JSON.stringify(site.project)).not.toContain("never-store");
    expect(remote.execute.mock.calls[0][0].connectedAccountId).toBe("chosen-account");
    expect(
      (await context.env.DB.prepare("SELECT * FROM composio_connector_session").all()).results,
    ).toEqual([]);
  });

  it("blocks writes, credentials and excluded project recipes before contacting the provider", async () => {
    await expect(
      snapshotSiteConnector(context, "site", { ...request, operation: "GMAIL_SEND_EMAIL" }),
    ).rejects.toMatchObject({ statusCode: 400 });
    await expect(
      snapshotSiteConnector(context, "site", { ...request, params: { password: "private" } }),
    ).rejects.toMatchObject({ statusCode: 400 });
    await resetSitesTestData(context);
    await saveTestSite(context, "project");
    await context.env.DB.prepare(
      "INSERT INTO project_capability (id, project_id, kind, capability_id, created_by, excluded) VALUES ('mail', 'project', 'recipe', 'morning-briefing', 1, 1)",
    ).run();
    await expect(
      snapshotSiteConnector(context, "site", { ...request, projectId: "project" }),
    ).rejects.toMatchObject({ statusCode: 403 });
    expect(remote.create).not.toHaveBeenCalled();
  });

  it.each(["account", "recipe"])(
    "discards provider results after %s authority is revoked",
    async (revoked) => {
      const scope = revoked === "recipe" ? { projectId: "project" } : {};

      if (revoked === "recipe") {
        await resetSitesTestData(context);
        await saveTestSite(context, "project");
        await context.env.DB.prepare(
          "INSERT INTO project_capability (id, project_id, kind, capability_id, created_by) VALUES ('mail', 'project', 'recipe', 'morning-briefing', 1)",
        ).run();
      }

      remote.execute.mockImplementationOnce(async () => {
        if (revoked === "account") {
          remote.accounts.mockResolvedValue([{ ...account, id: "other-account" }]);
        } else {
          await context.env.DB.prepare(
            "UPDATE project_capability SET excluded = 1 WHERE id = 'mail'",
          ).run();
        }

        return { data: { messages: [{ subject: "Private" }] } };
      });
      await expect(
        snapshotSiteConnector(context, "site", { ...request, ...scope }),
      ).rejects.toMatchObject({ statusCode: 403 });
      expect((await context.env.DB.prepare("SELECT id FROM source").all()).results).toEqual([]);
      expect((await getSite({ context, userId: 1, ...scope }, "site")).revision).toBe(1);
      expect(
        (await context.env.DB.prepare("SELECT * FROM composio_connector_session").all()).results,
      ).toEqual([]);
    },
  );

  it("removes an orphan Source when a concurrent site edit wins", async () => {
    const create = context.repositories.sources.createSource.bind(context.repositories.sources);

    vi.spyOn(context.repositories.sources, "createSource").mockImplementationOnce(async (input) => {
      const source = await create(input);

      await concurrentEdit();

      return source;
    });
    await expect(snapshotSiteConnector(context, "site", request)).rejects.toMatchObject({
      statusCode: 409,
    });
    expect(await storedSources()).toEqual([]);
    expect((await getSite({ context, userId: 1 }, "site")).revision).toBe(2);
  });

  it("leaves an unrelated session usable after snapshot cleanup", async () => {
    remote.create.mockResolvedValueOnce("unrelated-session");
    const unrelated = await discoverRecipeConnectorTools({
      context,
      userId: 1,
      completionId: context.connectorRunId,
      provider: "gmail",
      useCase: "Read mail",
      allowedOperations: ["GMAIL_FETCH_EMAILS"],
      connectedAccountId: "chosen-account",
      requireSelectedAccount: true,
    });

    await snapshotSiteConnector(context, "site", request);
    const result = await executeRecipeConnectorOperation({
      context,
      userId: 1,
      request: {
        provider: "gmail",
        operation: "GMAIL_FETCH_EMAILS",
        sessionId: unrelated.sessionId,
      },
      scope: { completionId: context.connectorRunId },
    });

    expect(result).toMatchObject({ data: { messages: [{ subject: "Review" }] } });
    await closeComposioConnectorRun(context);
  });
});
