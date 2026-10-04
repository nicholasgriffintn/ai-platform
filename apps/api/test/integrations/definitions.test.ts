import type { D1Database } from "@cloudflare/workers-types";
import { createIntegrationSnapshot } from "@ngriffin_uk/polychat-ai-integrations";
import { Miniflare } from "miniflare";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createServiceContext } from "~/infrastructure/context/serviceContext";
import { requireIntegrationDefinition } from "~/modules/integrations/application/access";
import {
  readIntegrationConnection,
  storeIntegrationConnection,
  disconnectIntegrationConnection,
} from "~/modules/integrations/application/connections";
import { revokeNativeIntegrationDefinition } from "~/modules/integrations/application/revoke-definition";
import { IntegrationDefinitionRepository } from "~/modules/integrations/infrastructure/IntegrationDefinitionRepository";

import { databaseTestEnvironment } from "../environment";
import { initialiseIntegrationDatabase, integrationTestUser } from "./database";

const runtime = new Miniflare({
  modules: true,
  script: "export default { fetch() { return new Response('test'); } }",
  compatibilityDate: "2026-08-01",
  d1Databases: ["DB"],
});
let database: D1Database;
let repository: IntegrationDefinitionRepository;

beforeAll(async () => {
  database = await runtime.getD1Database("DB");
  await initialiseIntegrationDatabase(database);
  repository = new IntegrationDefinitionRepository(databaseTestEnvironment(database));
});
beforeEach(async () => {
  await database.batch([
    database.prepare("DELETE FROM integration_definition_revision"),
    database.prepare("DELETE FROM integration_definition"),
    database.prepare("DELETE FROM provider_connection"),
  ]);
});
afterAll(() => runtime.dispose());

describe("native integration definitions and personal credentials", () => {
  it("preserves immutable snapshots, rejects stale review writes and isolates catalogues", async () => {
    const snapshot = await createIntegrationSnapshot({
      endpoint: "https://tools.example.com/mcp",
      authentication: "none",
      tools: [{ name: "search", inputSchema: { type: "object" } }],
    });
    const personal = await repository.create({
      userId: 1,
      name: "Private",
      description: "",
      snapshot,
    });

    await repository.create({
      userId: 2,
      workspaceId: "workspace",
      name: "Shared",
      description: "",
      snapshot,
    });
    const changed = await createIntegrationSnapshot({
      ...snapshot,
      tools: [{ name: "send", inputSchema: { type: "object" } }],
    });
    const revised = await repository.revise({
      id: personal.id,
      expectedRevision: 1,
      snapshot: changed,
    });

    expect(revised.revision).toBe(2);
    expect(await repository.getSnapshot(personal.id, 1)).toEqual(snapshot);
    await expect(
      repository.revise({ id: personal.id, expectedRevision: 1, snapshot }),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(await repository.list({ userId: 2 })).toEqual([]);
    expect(
      (await repository.list({ workspaceId: "workspace" })).map((definition) => definition.name),
    ).toEqual(["Shared"]);
    const foreignActor = createServiceContext({
      env: databaseTestEnvironment(database),
      user: integrationTestUser(2),
    });

    await expect(requireIntegrationDefinition(foreignActor, personal.id)).rejects.toMatchObject({
      statusCode: 404,
    });
    await repository.revoke(personal.id);
    expect(await repository.list({ userId: 1 })).toEqual([]);
  });

  it("encrypts credentials for their actor and endpoint, rotates approval identity and revokes immediately", async () => {
    const snapshot = await createIntegrationSnapshot({
      endpoint: "https://tools.example.com/mcp",
      authentication: "bearer",
      tools: [],
    });
    const definition = await repository.create({
      userId: 1,
      name: "Service",
      description: "",
      snapshot,
    });
    const environment = databaseTestEnvironment(database);

    environment.JWT_SECRET = "integration-test-encryption-key";
    const context = createServiceContext({ env: environment, user: integrationTestUser(1) });
    const scope = { context, userId: 1, definitionId: definition.id, snapshot };

    await storeIntegrationConnection({ ...scope, token: "private-test-token" });
    const connection = await readIntegrationConnection(scope);

    expect(connection?.token).toBe("private-test-token");
    const persisted = await database
      .prepare("SELECT encrypted_data, metadata FROM provider_connection")
      .first();

    expect(JSON.stringify(persisted)).not.toContain("private-test-token");
    expect(await readIntegrationConnection({ ...scope, userId: 2 })).toBeNull();
    await expect(
      storeIntegrationConnection({ ...scope, userId: 2, token: "foreign-test-token" }),
    ).rejects.toMatchObject({ statusCode: 403 });
    await expect(disconnectIntegrationConnection(context, 2, definition.id)).rejects.toMatchObject({
      statusCode: 403,
    });
    expect(
      await readIntegrationConnection({
        ...scope,
        snapshot: { ...snapshot, endpoint: "https://other.example.com/mcp" },
      }),
    ).toBeNull();
    await storeIntegrationConnection({ ...scope, token: "replacement-test-token" });
    expect((await readIntegrationConnection(scope))?.accountId).not.toBe(connection?.accountId);
    await disconnectIntegrationConnection(context, 1, definition.id);
    expect(await readIntegrationConnection(scope)).toBeNull();
    await storeIntegrationConnection({ ...scope, token: "revoked-test-token" });
    await revokeNativeIntegrationDefinition(context, definition.id);
    expect(await readIntegrationConnection(scope)).toBeNull();
    await expect(
      storeIntegrationConnection({ ...scope, token: "late-test-token" }),
    ).rejects.toMatchObject({ statusCode: 403 });
    expect(await readIntegrationConnection(scope)).toBeNull();
    await expect(requireIntegrationDefinition(context, definition.id)).rejects.toMatchObject({
      statusCode: 404,
    });
  });
});
