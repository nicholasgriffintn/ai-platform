import type { D1Database } from "@cloudflare/workers-types";
import { Miniflare } from "miniflare";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { createServiceContext } from "~/infrastructure/context/serviceContext";
import {
  connectNativeIntegrationAccount,
  createNativeIntegrationDefinition,
  publishNativeIntegrationRevision,
  reviewNativeIntegrationDefinition,
} from "~/modules/integrations/application/definitions";

import { createMcpTestServer } from "../../../../packages/ai-integrations/test/mcp-server";
import { databaseTestEnvironment } from "../environment";
import { initialiseIntegrationDatabase, integrationTestUser } from "./database";

const runtime = new Miniflare({
  modules: true,
  script: "export default { fetch() { return new Response('test'); } }",
  compatibilityDate: "2026-08-01",
  d1Databases: ["DB"],
});
let database: D1Database;

beforeAll(async () => {
  database = await runtime.getD1Database("DB");
  await initialiseIntegrationDatabase(database);
});
beforeEach(async () => {
  await database.batch([
    database.prepare("DELETE FROM integration_definition_revision"),
    database.prepare("DELETE FROM integration_definition"),
    database.prepare("DELETE FROM provider_connection"),
    database.prepare("UPDATE workspace_member SET role = 'owner' WHERE user_id = 1"),
  ]);
});
afterEach(() => vi.unstubAllGlobals());
afterAll(() => runtime.dispose());

describe("custom service review lifecycle", () => {
  it("connects a private account and publishes only the exact previewed service revision", async () => {
    const env = databaseTestEnvironment(database);

    env.JWT_SECRET = "lifecycle-test-encryption-key";
    const context = createServiceContext({ env, user: integrationTestUser(1) });
    const server = createMcpTestServer([{ name: "search", inputSchema: { type: "object" } }]);

    vi.stubGlobal("fetch", server.fetch);
    const created = await createNativeIntegrationDefinition(context, {
      name: "Service",
      description: "",
      endpoint: "https://tools.example.com/mcp",
      authentication: "bearer",
      token: "personal-test-token",
    });

    expect(created.integration.connected).toBe(true);
    expect(JSON.stringify(created)).not.toContain("personal-test-token");
    server.state.tools.push({
      name: "send",
      inputSchema: { type: "object", required: ["message"] },
    });
    const review = await reviewNativeIntegrationDefinition(context, created.integration.id);

    server.state.tools[1] = {
      name: "send",
      inputSchema: { type: "object", required: ["message", "recipient"] },
    };
    await expect(
      publishNativeIntegrationRevision(context, created.integration.id, {
        expectedRevision: 1,
        expectedDigest: review.snapshot.digest,
      }),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(
      (await context.repositories.integrationDefinitions.get(created.integration.id))?.revision,
    ).toBe(1);
    const latestReview = await reviewNativeIntegrationDefinition(context, created.integration.id);
    const saved = await publishNativeIntegrationRevision(context, created.integration.id, {
      expectedRevision: 1,
      expectedDigest: latestReview.snapshot.digest,
    });

    expect(saved.integration.revision).toBe(2);
    expect(
      (
        await context.repositories.integrationDefinitions.getSnapshot(created.integration.id, 1)
      )?.tools.map((tool) => tool.name),
    ).toEqual(["search"]);
    await connectNativeIntegrationAccount(
      context,
      created.integration.id,
      "replacement-test-token",
    );
    expect(server.state.requests.at(-1)?.authorization).toBe("Bearer replacement-test-token");
  });

  it("denies member curation before network access and rechecks admin rights after service discovery", async () => {
    const env = databaseTestEnvironment(database);

    env.JWT_SECRET = "lifecycle-test-encryption-key";
    const owner = createServiceContext({ env, user: integrationTestUser(1) });
    const member = createServiceContext({ env, user: integrationTestUser(2) });
    const server = createMcpTestServer([]);

    vi.stubGlobal("fetch", server.fetch);
    const input = {
      name: "Workspace service",
      description: "",
      workspaceId: "workspace",
      endpoint: "https://tools.example.com/mcp",
      authentication: "none",
    } as const;

    await expect(createNativeIntegrationDefinition(member, input)).rejects.toMatchObject({
      statusCode: 403,
    });
    expect(server.state.requests).toEqual([]);
    server.state.beforeList = async () => {
      await database.prepare("UPDATE workspace_member SET role = 'member' WHERE user_id = 1").run();
    };

    await expect(createNativeIntegrationDefinition(owner, input)).rejects.toMatchObject({
      statusCode: 403,
    });
    expect(
      await owner.repositories.integrationDefinitions.list({ workspaceId: "workspace" }),
    ).toEqual([]);
  });
});
