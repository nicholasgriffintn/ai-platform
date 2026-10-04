import type { D1Database } from "@cloudflare/workers-types";
import { createIntegrationSnapshot } from "@ngriffin_uk/polychat-ai-integrations";
import { Miniflare } from "miniflare";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createServiceContext } from "~/infrastructure/context/serviceContext";
import { requireIntegrationDefinition } from "~/modules/integrations/application/access";
import {
  listDiscoverableNativeIntegrations,
  scopeNativeIntegrationDiscoveryToTeammate,
} from "~/modules/integrations/application/catalogue";
import { storeIntegrationConnection } from "~/modules/integrations/application/connections";
import { requireIntegrationExecutionAuthority } from "~/modules/integrations/application/execution-authority";
import { validateProjectIntegrationGrant } from "~/modules/integrations/application/grants";

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
    database.prepare("DELETE FROM project_capability"),
    database.prepare("DELETE FROM teammate_context"),
    database.prepare("DELETE FROM teammate_connection_grant"),
    database.prepare("DELETE FROM workspace_member"),
    database.prepare(
      "INSERT INTO workspace_member VALUES ('workspace', 1, 'owner'), ('workspace', 2, 'member')",
    ),
  ]);
});
afterAll(() => runtime.dispose());

describe("native integration execution authority", () => {
  it("pins project tools and uses each runner's credentials, then honours grant and membership revocation", async () => {
    const environment = databaseTestEnvironment(database);

    environment.JWT_SECRET = "integration-authority-test-key";
    const owner = createServiceContext({ env: environment, user: integrationTestUser(1) });
    const member = createServiceContext({ env: environment, user: integrationTestUser(2) });
    const snapshot = await createIntegrationSnapshot({
      endpoint: "https://tools.example.com/mcp",
      authentication: "bearer",
      tools: [{ name: "search", inputSchema: { type: "object" } }],
    });
    const definition = await owner.repositories.integrationDefinitions.create({
      userId: 1,
      workspaceId: "workspace",
      name: "Service",
      description: "",
      snapshot,
    });

    await storeIntegrationConnection({
      context: owner,
      userId: 1,
      definitionId: definition.id,
      snapshot,
      token: "owner-test-token",
    });
    await storeIntegrationConnection({
      context: member,
      userId: 2,
      definitionId: definition.id,
      snapshot,
      token: "member-test-token",
    });
    await database
      .prepare(
        "INSERT INTO project_capability (id, project_id, kind, capability_id, configuration, created_by) VALUES ('grant', 'project', 'integration', ?, ?, 1)",
      )
      .bind(definition.id, JSON.stringify({ revision: 1, operations: ["search"] }))
      .run();
    const request = {
      context: member,
      userId: 2,
      definitionId: definition.id,
      projectId: "project",
    };
    const granted = await requireIntegrationExecutionAuthority(request);

    expect(granted.operations).toEqual(["search"]);
    expect(granted.connection.token).toBe("member-test-token");
    await expect(
      requireIntegrationDefinition(member, definition.id, "write"),
    ).rejects.toMatchObject({ statusCode: 403 });
    await expect(
      requireIntegrationExecutionAuthority({ ...request, projectId: undefined }),
    ).rejects.toMatchObject({ statusCode: 403 });
    const updated = await createIntegrationSnapshot({
      ...snapshot,
      tools: [...snapshot.tools, { name: "send", inputSchema: { type: "object" } }],
    });

    await owner.repositories.integrationDefinitions.revise({
      id: definition.id,
      expectedRevision: 1,
      snapshot: updated,
    });
    const stillPinned = await requireIntegrationExecutionAuthority(request);

    expect(stillPinned.definition.revision).toBe(1);
    expect(stillPinned.connectedAccountId).toBe(granted.connectedAccountId);
    expect(stillPinned.operations).toEqual(["search"]);
    const discovered = await listDiscoverableNativeIntegrations(member, "project");

    expect(
      discovered.map((integration) => ({
        revision: integration.revision,
        operations: integration.snapshot.tools.map((tool) => tool.name),
      })),
    ).toEqual([{ revision: 1, operations: ["search"] }]);
    await expect(
      validateProjectIntegrationGrant({
        context: owner,
        workspaceId: "workspace",
        kind: "integration",
        capabilityId: definition.id,
        configuration: { revision: 1, operations: ["search"] },
      }),
    ).rejects.toMatchObject({ statusCode: 400 });
    await database.prepare("UPDATE project_capability SET excluded = 1 WHERE id = 'grant'").run();
    await expect(requireIntegrationExecutionAuthority(request)).rejects.toMatchObject({
      statusCode: 403,
    });
    await database.prepare("UPDATE project_capability SET excluded = 0 WHERE id = 'grant'").run();
    await database.prepare("DELETE FROM workspace_member WHERE user_id = 2").run();
    await expect(requireIntegrationExecutionAuthority(request)).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  it("intersects admitted teammate grants with live exact operations and rejects changed or archived authority", async () => {
    const environment = databaseTestEnvironment(database);

    environment.JWT_SECRET = "integration-authority-test-key";
    const context = createServiceContext({ env: environment, user: integrationTestUser(1) });
    const snapshot = await createIntegrationSnapshot({
      endpoint: "https://tools.example.com/mcp",
      authentication: "none",
      tools: ["search", "send"].map((name) => ({ name, inputSchema: { type: "object" } })),
    });
    const definition = await context.repositories.integrationDefinitions.create({
      userId: 1,
      name: "Service",
      description: "",
      snapshot,
    });

    await storeIntegrationConnection({ context, userId: 1, definitionId: definition.id, snapshot });
    const connection = await context.repositories.providerConnections.getConnection(
      1,
      definition.id,
      "native_mcp",
    );

    expect(connection).not.toBeNull();
    if (!connection) {
      throw new Error("Missing test connection");
    }

    await database
      .prepare(
        "INSERT INTO teammate_context (id, teammate_id, actor_user_id, scope_type, scope_id, home_conversation_id, memory_document_id) VALUES ('context', 'teammate', 1, 'personal', '1', 'chat', 'memory')",
      )
      .run();
    const grant = await context.repositories.teammateContexts.upsertConnectionGrant({
      contextId: "context",
      connectionId: connection.id,
      allowedOperations: ["search", "send"],
    });

    expect(grant).not.toBeNull();
    if (!grant) {
      throw new Error("Missing test grant");
    }

    const request = {
      context,
      userId: 1,
      definitionId: definition.id,
      teammateContextId: "context",
      admittedGrants: [{ ...grant, allowedOperations: ["search"] }],
    };
    const authority = await requireIntegrationExecutionAuthority(request);

    expect(authority.operations).toEqual(["search"]);
    expect(authority.authorityRevision).toBe(1);
    const integrations = await listDiscoverableNativeIntegrations(context);
    const discovered = await scopeNativeIntegrationDiscoveryToTeammate({
      ...request,
      integrations,
    });

    expect(discovered.flatMap((item) => item.snapshot.tools.map((tool) => tool.name))).toEqual([
      "search",
    ]);
    await context.repositories.teammateContexts.upsertConnectionGrant({
      contextId: "context",
      connectionId: connection.id,
      expectedRevision: 1,
      allowedOperations: ["search"],
    });
    await expect(requireIntegrationExecutionAuthority(request)).rejects.toMatchObject({
      statusCode: 403,
    });
    expect(await scopeNativeIntegrationDiscoveryToTeammate({ ...request, integrations })).toEqual(
      [],
    );
    await database
      .prepare("UPDATE teammate_context SET status = 'archived' WHERE id = 'context'")
      .run();
    await expect(
      requireIntegrationExecutionAuthority({ ...request, admittedGrants: undefined }),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it("rejects malformed and unreviewed grants with validation errors", async () => {
    const context = createServiceContext({
      env: databaseTestEnvironment(database),
      user: integrationTestUser(1),
    });
    const snapshot = await createIntegrationSnapshot({
      endpoint: "https://tools.example.com/mcp",
      authentication: "none",
      tools: [{ name: "search", inputSchema: { type: "object" } }],
    });
    const definition = await context.repositories.integrationDefinitions.create({
      userId: 1,
      workspaceId: "workspace",
      name: "Service",
      description: "",
      snapshot,
    });
    const request = { context, workspaceId: "workspace", capabilityId: definition.id };

    await expect(
      validateProjectIntegrationGrant({
        ...request,
        kind: "integration",
        configuration: { revision: 1, operations: ["*"] },
      }),
    ).rejects.toMatchObject({ statusCode: 400 });
    await expect(
      validateProjectIntegrationGrant({ ...request, kind: "integration", configuration: {} }),
    ).rejects.toMatchObject({ statusCode: 400 });
    await expect(
      validateProjectIntegrationGrant({
        ...request,
        kind: "connector",
        capabilityId: "composio",
        configuration: {},
      }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });
});
