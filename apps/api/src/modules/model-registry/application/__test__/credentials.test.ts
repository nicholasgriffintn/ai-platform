import { readFile } from "node:fs/promises";

import type { D1Database } from "@cloudflare/workers-types";
import { Miniflare } from "miniflare";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import type { RepositoryManager } from "~/infrastructure/database/repositoryManager";
import { WorkspaceProviderConnectionRepository } from "~/modules/workspaces/infrastructure/WorkspaceProviderConnectionRepository";

import {
  checkHuggingFaceToken,
  deleteHuggingFaceConnection,
  getHuggingFaceConnection,
  requireTrainingCredentials,
  saveHuggingFaceConnection,
} from "../credentials";

const WORKSPACE = "ws-1";
const ADMIN = { id: 1, plan_id: "pro" };
const MEMBER = { id: 2, plan_id: "pro" };
const WRITE_TOKEN = "hf_write_token_value";
const READ_TOKEN = "hf_read_token_value";
const LOCATION = { endpointVendor: "aws", endpointRegion: "eu-west-1" };
const PLATFORM = {
  HUGGINGFACE_TOKEN: "hf_platform_token",
  HUGGINGFACE_NAMESPACE: "platform-org",
};

const runtime = new Miniflare({
  modules: true,
  script: "export default { fetch() { return new Response('test'); } }",
  compatibilityDate: "2026-08-01",
  d1Databases: ["DB"],
});

let database: D1Database;
let env: { DB: D1Database; PRIVATE_KEY: string } & Partial<typeof PLATFORM>;
let repositories: RepositoryManager;

function identity(token: string) {
  if (token === WRITE_TOKEN) {
    return {
      name: "ada",
      auth: { accessToken: { role: "write" } },
      orgs: [
        { name: "acme", roleInOrg: "write" },
        { name: "readers", roleInOrg: "read" },
      ],
    };
  }

  return token === READ_TOKEN
    ? { name: "ada", auth: { accessToken: { role: "read" } }, orgs: [] }
    : null;
}

afterAll(async () => {
  await runtime.dispose();
});

beforeAll(async () => {
  database = await runtime.getD1Database("DB");

  await database.batch([
    database.prepare("CREATE TABLE user (id INTEGER PRIMARY KEY)"),
    database.prepare("CREATE TABLE workspace (id TEXT PRIMARY KEY)"),
    database.prepare("INSERT INTO user VALUES (1), (2)"),
    database.prepare(`INSERT INTO workspace VALUES ('${WORKSPACE}')`),
  ]);

  const migration = await readFile(
    new URL("../../../../../migrations/0053_workspace_provider_connections.sql", import.meta.url),
    "utf8",
  );

  await database.prepare(migration).run();
});

beforeEach(async () => {
  await database.prepare("DELETE FROM workspace_provider_connection").run();

  env = {
    DB: database,
    PRIVATE_KEY: btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))),
  };

  const fakes = {
    workspaceProviderConnections: new WorkspaceProviderConnectionRepository(env),
    audit: { createRecord: async () => undefined },
    workspaces: {
      getWorkspace: async (id: string) => ({ id }),
      getMembership: async (_workspaceId: string, userId: number) => ({
        role: userId === ADMIN.id ? "admin" : "member",
      }),
    },
  };

  repositories = fakes as unknown as RepositoryManager;

  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, init?: RequestInit) => {
      const token = new Headers(init?.headers).get("Authorization")?.replace("Bearer ", "") ?? "";
      const body = identity(token);

      return body
        ? Response.json(body)
        : Response.json({ error: "Invalid credentials" }, { status: 401 });
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function contextFor(user: typeof ADMIN): ServiceContext {
  return { env, repositories, requireUser: () => user } as unknown as ServiceContext;
}

describe("workspace Hugging Face credentials", () => {
  it("falls back to the platform token until the workspace connects its own", async () => {
    env = { ...env, ...PLATFORM };

    await expect(getHuggingFaceConnection(contextFor(MEMBER), WORKSPACE)).resolves.toMatchObject({
      source: "platform",
      organisation: "platform-org",
      canTrainAndDeploy: true,
    });

    await saveHuggingFaceConnection(contextFor(ADMIN), WORKSPACE, {
      token: WRITE_TOKEN,
      organisation: "acme",
      ...LOCATION,
    });

    const credentials = await requireTrainingCredentials(env, repositories, WORKSPACE);

    expect(credentials.huggingface).toEqual({
      token: WRITE_TOKEN,
      namespace: "acme",
      ...LOCATION,
    });

    await deleteHuggingFaceConnection(contextFor(ADMIN), WORKSPACE);

    await expect(getHuggingFaceConnection(contextFor(MEMBER), WORKSPACE)).resolves.toMatchObject({
      source: "platform",
    });
  });

  it("stores the token encrypted and never returns it", async () => {
    const connection = await saveHuggingFaceConnection(contextFor(ADMIN), WORKSPACE, {
      token: WRITE_TOKEN,
      organisation: null,
      ...LOCATION,
    });
    const stored = await database
      .prepare("SELECT encrypted_secret FROM workspace_provider_connection")
      .first<{ encrypted_secret: string }>();

    expect(stored?.encrypted_secret).not.toContain(WRITE_TOKEN);
    expect(JSON.stringify(connection)).not.toContain(WRITE_TOKEN);
    expect(connection).toMatchObject({ source: "workspace", account: "ada", organisation: "ada" });
  });

  it("keeps the saved token when only the organisation or location changes", async () => {
    await saveHuggingFaceConnection(contextFor(ADMIN), WORKSPACE, {
      token: WRITE_TOKEN,
      organisation: null,
      ...LOCATION,
    });

    await expect(
      checkHuggingFaceToken(contextFor(ADMIN), WORKSPACE, undefined),
    ).resolves.toMatchObject({
      account: "ada",
      organisations: [
        { name: "acme", canWrite: true },
        { name: "readers", canWrite: false },
      ],
    });

    const connection = await saveHuggingFaceConnection(contextFor(ADMIN), WORKSPACE, {
      organisation: "acme",
      endpointVendor: "gcp",
      endpointRegion: "us-east4",
    });

    expect(connection).toMatchObject({ organisation: "acme", endpointRegion: "us-east4" });
  });

  it("allows search but blocks training when the token cannot write to the organisation", async () => {
    const connection = await saveHuggingFaceConnection(contextFor(ADMIN), WORKSPACE, {
      token: WRITE_TOKEN,
      organisation: "readers",
      ...LOCATION,
    });

    expect(connection.canTrainAndDeploy).toBe(false);
    await expect(requireTrainingCredentials(env, repositories, WORKSPACE)).rejects.toMatchObject({
      statusCode: 409,
    });
  });

  it("rejects bad tokens, foreign organisations, unknown locations and non-admins", async () => {
    await expect(
      saveHuggingFaceConnection(contextFor(ADMIN), WORKSPACE, {
        token: "hf_not_a_real_token",
        organisation: null,
        ...LOCATION,
      }),
    ).rejects.toThrow("Hugging Face rejected that token");

    await expect(
      saveHuggingFaceConnection(contextFor(ADMIN), WORKSPACE, {
        token: WRITE_TOKEN,
        organisation: "someone-else",
        ...LOCATION,
      }),
    ).rejects.toThrow("not a member of someone-else");

    await expect(
      saveHuggingFaceConnection(contextFor(ADMIN), WORKSPACE, {
        token: WRITE_TOKEN,
        organisation: null,
        endpointVendor: "aws",
        endpointRegion: "ap-south-1",
      }),
    ).rejects.toThrow("supported endpoint location");

    await expect(
      checkHuggingFaceToken(contextFor(MEMBER), WORKSPACE, READ_TOKEN),
    ).rejects.toMatchObject({ statusCode: 403 });
  });
});
