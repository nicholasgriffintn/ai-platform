import { siteConnectorSnapshotRequestSchema, sourceSchema } from "@ngriffin_uk/polychat-schemas";
import { Miniflare } from "miniflare";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { createServiceContext, type ServiceContext } from "~/infrastructure/context/serviceContext";

import { browserTestUser } from "../../../../../test/computer-use";
import { databaseTestEnvironment } from "../../../../../test/environment";
import { testSite } from "../../../../../test/sites/fixtures";

const mocks = vi.hoisted(() => ({
  access: vi.fn(),
  discover: vi.fn(),
  execute: vi.fn(),
  account: vi.fn(),
  close: vi.fn(),
  create: vi.fn(),
  remove: vi.fn(),
  update: vi.fn(),
}));

vi.mock("../integration-access", () => ({ requireSiteIntegrationAccess: mocks.access }));
vi.mock("../records", () => ({ updateSite: mocks.update }));
vi.mock("~/modules/apps/application/connectors/operations", () => ({
  discoverRecipeConnectorTools: mocks.discover,
  executeRecipeConnectorOperation: mocks.execute,
  getActiveComposioAccountForProvider: mocks.account,
}));
vi.mock("~/modules/apps/application/connectors/composio-run", () => ({
  closeComposioConnectorSession: mocks.close,
}));
vi.mock("~/modules/sources/application/sources", () => ({
  createSource: mocks.create,
  deleteSource: mocks.remove,
}));

import { snapshotSiteConnector } from "../connector-data";

const runtime = new Miniflare({
  modules: true,
  script: "export default { fetch() { return new Response('test'); } }",
  compatibilityDate: "2026-08-01",
  d1Databases: ["DB"],
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

beforeAll(async () => {
  context = createServiceContext({
    env: databaseTestEnvironment(await runtime.getD1Database("DB")),
    user: browserTestUser,
  });
});
afterAll(() => runtime.dispose());
beforeEach(() => {
  vi.clearAllMocks();
  mocks.access.mockResolvedValue(testSite);
  mocks.discover.mockResolvedValue({ sessionId: "own-session" });
  mocks.execute.mockResolvedValue({ messages: [{ subject: "Review", token: "never-store" }] });
  mocks.account.mockResolvedValue({ id: "chosen-account" });
  mocks.create.mockResolvedValue(
    sourceSchema.parse({
      id: "source",
      createdByUserId: 1,
      projectId: null,
      conversationId: null,
      connectionId: null,
      kind: "connector",
      title: "Mail",
      status: "available",
      content: "[]",
      provider: "gmail",
      externalUri: null,
      vectorId: null,
      metadata: {},
      file: null,
      createdAt: "2026-10-04",
      updatedAt: null,
    }),
  );
  mocks.update.mockResolvedValue(testSite);
});

describe("connector-backed site sources", () => {
  it("reads from an exact account, projects rows, rechecks authority and closes its session", async () => {
    const authority = vi.fn().mockResolvedValue(undefined);

    await snapshotSiteConnector(
      context,
      "site",
      { ...request, params: { query: "a1b2c3d4-1234-5678-9012-aabbccddee99" } },
      authority,
    );
    expect(mocks.discover).toHaveBeenCalledWith(
      expect.objectContaining({
        connectedAccountId: "chosen-account",
        requireSelectedAccount: true,
        allowedOperations: ["GMAIL_FETCH_EMAILS"],
      }),
    );
    expect(mocks.create.mock.calls[0]?.[0]).toBe(context);
    expect(mocks.create.mock.calls[0]?.[2]).toMatchObject({
      kind: "connector",
      content: '[{"title":"Review"}]',
    });
    expect(authority).toHaveBeenCalledTimes(2);
    expect(mocks.account).toHaveBeenCalledWith(
      expect.objectContaining({
        connectedAccountId: "chosen-account",
        requireSelectedAccount: true,
      }),
    );
    expect(mocks.close.mock.calls[0]?.[1]).toBe("own-session");
  });

  it("blocks writes and credential parameters before contacting the provider", async () => {
    await expect(
      snapshotSiteConnector(context, "site", { ...request, operation: "GMAIL_SEND_EMAIL" }),
    ).rejects.toThrow("read operations");
    await expect(
      snapshotSiteConnector(context, "site", { ...request, params: { password: "private" } }),
    ).rejects.toThrow("credentials");
    expect(mocks.discover).not.toHaveBeenCalled();
  });

  it("discards results after a revoked account or grant", async () => {
    mocks.account.mockRejectedValueOnce(new Error("Account revoked"));
    await expect(snapshotSiteConnector(context, "site", request)).rejects.toThrow("revoked");
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.close.mock.calls[0]?.[1]).toBe("own-session");
    const authority = vi
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("Grant revoked"));

    await expect(snapshotSiteConnector(context, "site", request, authority)).rejects.toThrow(
      "Grant revoked",
    );
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("deletes an orphan snapshot when a concurrent site edit wins", async () => {
    mocks.update.mockRejectedValueOnce(new Error("Revision conflict"));
    await expect(snapshotSiteConnector(context, "site", request)).rejects.toThrow(
      "Revision conflict",
    );
    expect(mocks.remove.mock.calls[0]?.slice(1)).toEqual([1, "source"]);
    expect(mocks.close.mock.calls[0]?.[1]).toBe("own-session");
  });
});
