import { Miniflare } from "miniflare";
import { afterAll, beforeAll, expect, it } from "vitest";

import { createServiceContext, type ServiceContext } from "~/infrastructure/context/serviceContext";

import { databaseTestEnvironment } from "../../../../../test/environment";
import { signedInUser } from "../../../../../test/fixtures/user";
import {
  createMcpConnection,
  deleteMcpConnection,
  listMcpConnections,
  resolveMcpCredential,
} from "../mcp-connections";

const runtime = new Miniflare({
  modules: true,
  script: "export default { fetch() { return new Response('test'); } }",
  compatibilityDate: "2026-08-01",
  d1Databases: ["DB"],
});
let owner: ServiceContext;
let foreign: ServiceContext;

beforeAll(async () => {
  const DB = await runtime.getD1Database("DB");

  await DB.prepare(`CREATE TABLE provider_connection (
    id TEXT PRIMARY KEY, user_id INTEGER, provider TEXT, kind TEXT, external_id TEXT,
    status TEXT, encrypted_data TEXT, metadata TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP, updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`).run();
  const env = databaseTestEnvironment(DB);

  env.JWT_SECRET = "test-mcp-credential-key-with-at-least-32-characters";
  owner = createServiceContext({ env, user: signedInUser });
  foreign = createServiceContext({ env, user: { ...signedInUser, id: 2 } });
});
afterAll(() => runtime.dispose());

it("seals tokens and enforces owner, recipient, endpoint and exact tool permissions", async () => {
  const saved = await createMcpConnection(owner, {
    label: "CAIPE",
    url: "https://mcp.example.test/api",
    token: "dummy-test-token",
    allowedTools: ["search"],
    credentialRecipient: "openai",
  });
  const record = await owner.repositories.providerConnections.getConnectionById(saved.id);

  expect(JSON.stringify(saved)).not.toContain("dummy-test-token");
  expect(record?.encrypted_data).not.toContain("dummy-test-token");
  expect(await listMcpConnections(foreign)).toEqual({ connections: [] });
  const input = {
    connectionId: saved.id,
    url: saved.url,
    provider: "openai",
    allowedTools: ["search"],
  };

  await expect(resolveMcpCredential(foreign, input)).rejects.toMatchObject({ statusCode: 404 });
  await expect(
    resolveMcpCredential(owner, { ...input, url: "https://other.example.test/api" }),
  ).rejects.toMatchObject({ statusCode: 403 });
  await expect(resolveMcpCredential(owner, { ...input, provider: "other" })).rejects.toMatchObject({
    statusCode: 403,
  });
  await expect(
    resolveMcpCredential(owner, { ...input, allowedTools: ["delete"] }),
  ).rejects.toMatchObject({ statusCode: 403 });
  expect(await resolveMcpCredential(owner, input)).toEqual({
    authorization: "dummy-test-token",
    allowedTools: ["search"],
  });
  await deleteMcpConnection(owner, saved.id);
  await expect(resolveMcpCredential(owner, input)).rejects.toMatchObject({ statusCode: 404 });
});
