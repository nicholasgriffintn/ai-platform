import type { D1Database } from "@cloudflare/workers-types";
import * as integrations from "@ngriffin_uk/polychat-ai-integrations";
import { Miniflare } from "miniflare";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { createServiceContext } from "~/infrastructure/context/serviceContext";
import * as connectorAdapters from "~/modules/apps/application/connectors/connector-adapters";
import { requireKnowledgeConnectorSession } from "~/modules/apps/application/connectors/knowledge";
import { SourceSyncRepository } from "~/modules/sources/infrastructure/SourceSyncRepository";
import { TaskService } from "~/modules/tasks/application/TaskService";

import { databaseTestEnvironment } from "../../../../../test/environment";
import {
  knowledgeTestConnector,
  knowledgeTestAccount,
} from "../../../../../test/fixtures/sources/connector";
import { prepareKnowledgeDatabase } from "../../../../../test/fixtures/sources/database";
import { knowledgeTestUser } from "../../../../../test/fixtures/sources/users";
import { runSourceSyncPage, scheduleSourceSyncs } from "../source-sync-worker";
import { requireSourceAccess } from "../sources";

const runtime = new Miniflare({
  modules: true,
  script: "export default { fetch() { return new Response('test'); } }",
  compatibilityDate: "2026-08-01",
  d1Databases: ["DB"],
});
let database: D1Database;

beforeAll(async () => {
  database = await runtime.getD1Database("DB");
  await prepareKnowledgeDatabase(database);
  await database
    .prepare(
      "INSERT INTO provider_connection (id, user_id, provider, kind, external_id, status) VALUES ('notion-connection', 1, 'notion', ?, 'notion-account', 'connected')",
    )
    .bind(integrations.CONNECTOR_ACCOUNT_REFERENCE_KIND)
    .run();
  const original = connectorAdapters.getRecipeConnectorProviderConfig;

  vi.spyOn(connectorAdapters, "getRecipeConnectorProviderConfig").mockImplementation((provider) =>
    provider === "notion" ? knowledgeTestConnector : original(provider),
  );
  vi.spyOn(integrations, "listComposioConnectedAccounts").mockResolvedValue([knowledgeTestAccount]);
  vi.spyOn(TaskService.prototype, "enqueueTask").mockResolvedValue("queued-source-sync");
});

afterAll(async () => {
  vi.restoreAllMocks();
  await runtime.dispose();
});

describe("provider-independent source sync", () => {
  it("resumes a non-folder adapter through the shared worker without exposing a person's source to another user", async () => {
    const env = databaseTestEnvironment(database);
    const context = createServiceContext({ env, user: knowledgeTestUser });
    const otherContext = createServiceContext({
      env,
      user: { ...knowledgeTestUser, id: 2, email: "two@example.com" },
    });
    const repository = new SourceSyncRepository(env);
    const sync = await repository.create(
      1,
      { provider: "notion", title: "Decisions", rootId: "collection/decisions" },
      "notion-connection",
    );

    await scheduleSourceSyncs(env);
    const started = await repository.get(sync.id);

    if (!started?.run_id) {
      throw new Error("The collection scan did not start");
    }

    await runSourceSyncPage(
      context,
      { syncId: sync.id, runId: started.run_id, page: 0 },
      async () => {},
    );
    const checkpoint = await repository.get(sync.id);

    expect(JSON.parse(checkpoint?.checkpoint ?? "null")).toEqual({
      collection: "collection/decisions",
      cursor: "next",
    });
    const source = await repository.getSyncedSource(sync.id, "collection/page-1");

    if (!source) {
      throw new Error("The collection document was not saved");
    }

    await expect(requireSourceAccess(otherContext, 2, source.id)).rejects.toMatchObject({
      statusCode: 404,
    });
    await expect(
      runSourceSyncPage(
        otherContext,
        { syncId: sync.id, runId: started.run_id, page: 1 },
        async () => {},
      ),
    ).rejects.toMatchObject({ statusCode: 403 });
    await runSourceSyncPage(
      context,
      { syncId: sync.id, runId: started.run_id, page: 1 },
      async () => {},
    );

    expect((await repository.get(sync.id))?.status).toBe("available");
    expect(
      await database
        .prepare("SELECT count(*) FROM source WHERE sync_id = ?")
        .bind(sync.id)
        .first("count(*)"),
    ).toBe(1);
    expect((await repository.getSyncedSource(sync.id, "collection/page-1"))?.content).toBe(
      "A current collection decision",
    );
  });

  it("rejects another user's connection, a mismatched provider and an upstream account from a different toolkit", async () => {
    const env = databaseTestEnvironment(database);
    const context = createServiceContext({ env, user: knowledgeTestUser });
    const otherContext = createServiceContext({ env, user: { ...knowledgeTestUser, id: 2 } });

    await expect(
      requireKnowledgeConnectorSession(otherContext, "notion-connection", "notion"),
    ).rejects.toMatchObject({ statusCode: 403 });
    await expect(
      requireKnowledgeConnectorSession(context, "notion-connection", "googledrive"),
    ).rejects.toMatchObject({ statusCode: 403 });
    vi.mocked(integrations.listComposioConnectedAccounts).mockResolvedValue([
      { ...knowledgeTestAccount, toolkitSlug: "googledrive" },
    ]);
    await expect(
      requireKnowledgeConnectorSession(context, "notion-connection", "notion"),
    ).rejects.toMatchObject({ statusCode: 403 });
  });
});
