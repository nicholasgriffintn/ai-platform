import type { D1Database } from "@cloudflare/workers-types";
import { AssistantError } from "@ngriffin_uk/polychat-utility-server/errors";
import { Hono } from "hono";
import { Miniflare } from "miniflare";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import managedAgentRoutes from "~/modules/apps/api/managed-agents";
import {
  initialiseManagedAgentsDatabase,
  managedAgentTestContext,
  managedAgentTestInput,
  managedAgentTestUser,
} from "~/test-utils/managed-agents";

import {
  cancelManagedAgentTurn,
  createManagedAgentSession,
  deleteManagedAgentSession,
  listManagedAgentItems,
  listManagedAgentSessions,
  retrieveManagedAgentSession,
  streamManagedAgentEvents,
  submitManagedAgentMessage,
} from "./sessions";

const runtime = new Miniflare({
  modules: true,
  script: "export default { fetch() { return new Response('test'); } }",
  compatibilityDate: "2026-08-01",
  d1Databases: ["DB"],
});
let database: D1Database;
let context: ServiceContext;
const fetchMock = vi.fn<typeof fetch>();
const upstreamSession = { ...managedAgentTestInput, id: "sess_test", status: "idle" };

beforeAll(async () => {
  database = await runtime.getD1Database("DB");
  await initialiseManagedAgentsDatabase(database);
});
afterAll(() => runtime.dispose());
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
beforeEach(async () => {
  await database.batch([
    database.prepare("DELETE FROM activity_record"),
    database.prepare("DELETE FROM workspace_audit_record"),
    database.prepare("DELETE FROM workspace_provider_connection"),
    database.prepare("UPDATE workspace_member SET role = 'owner' WHERE user_id = 42"),
  ]);
  context = managedAgentTestContext(database);
  vi.spyOn(context.repositories.userSettings, "getProviderApiKey").mockResolvedValue(
    "personal-access::@@::personal-secret",
  );
  fetchMock.mockReset();
  fetchMock.mockImplementation(async () => Response.json(upstreamSession));
  vi.stubGlobal("fetch", fetchMock);
});

async function connectWorkspace() {
  await context.repositories.modelConnections.saveConnection({
    workspaceId: "workspace-1",
    provider: "aws",
    account: "123456789012",
    config: { region: "us-east-1" },
    secrets: {
      accessKeyId: "workspace-access",
      secretAccessKey: "workspace-secret",
      sessionToken: "workspace-token",
    },
    capabilities: { read: true, store: false, train: false, host: false },
    updatedBy: 42,
  });
}

function lastRequest(): Request {
  const request = fetchMock.mock.calls.at(-1)?.[0];

  if (!(request instanceof Request)) {
    throw new Error("Expected an AWS request");
  }

  return request;
}

function routeApp(userId: number | null = 42) {
  const app = new Hono<{ Variables: { user: ReturnType<typeof managedAgentTestUser> } }>();

  app.use("*", async (c, next) => {
    if (userId) {
      c.set("user", managedAgentTestUser(userId));
    }

    await next();
  });
  app.route("/agents", managedAgentRoutes);
  app.onError((error, c) => {
    if (error instanceof AssistantError) {
      return c.json(
        { message: error.message },
        error.statusCode === 404 ? 404 : error.statusCode === 403 ? 403 : 401,
      );
    }

    throw error;
  });

  return app;
}

describe("scoped managed agent sessions", () => {
  it("persists personal ownership without storing credentials, instructions or outputs", async () => {
    const { session } = await createManagedAgentSession(context, managedAgentTestInput);

    expect(session).toMatchObject({ projectId: null, sessionId: "sess_test", status: "waiting" });
    expect(lastRequest().headers.get("authorization")).toContain("Credential=personal-access/");
    const record = await context.repositories.activities.getActivityById(session.id);

    expect(record?.data).not.toContain("personal-secret");
    expect(record?.data).not.toContain("instructions");
    expect((await listManagedAgentSessions(context, {})).sessions).toHaveLength(1);
  });

  it("uses encrypted workspace credentials for a project and audits without message text", async () => {
    await connectWorkspace();
    const { session } = await createManagedAgentSession(
      context,
      managedAgentTestInput,
      "project-1",
    );

    expect(lastRequest().headers.get("authorization")).toContain("Credential=workspace-access/");
    expect(lastRequest().headers.get("x-amz-security-token")).toBe("workspace-token");
    expect(context.repositories.userSettings.getProviderApiKey).not.toHaveBeenCalled();
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 202 }));
    expect(
      await submitManagedAgentMessage(context, session.id, { text: "Private task content" }),
    ).toEqual({ accepted: true });
    const audits = await context.repositories.audit.listRecords("workspace-1", { limit: 10 });

    expect(audits.map((record) => record.action)).toContain("managed_agent.message_submitted");
    expect(JSON.stringify(audits)).not.toContain("Private task content");
    const connection = await database
      .prepare("SELECT encrypted_secret FROM workspace_provider_connection")
      .first<{ encrypted_secret: string }>();

    expect(connection?.encrypted_secret).not.toContain("workspace-secret");
  });

  it("does not fall back to personal or platform credentials for a disconnected workspace", async () => {
    await expect(
      createManagedAgentSession(context, managedAgentTestInput, "project-1"),
    ).rejects.toThrow("Connect AWS");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(context.repositories.userSettings.getProviderApiKey).not.toHaveBeenCalled();
    expect((await listManagedAgentSessions(context, {})).sessions).toHaveLength(0);
  });

  it("does not use platform credentials when the personal Bedrock key is missing", async () => {
    vi.mocked(context.repositories.userSettings.getProviderApiKey).mockResolvedValueOnce(null);
    await expect(createManagedAgentSession(context, managedAgentTestInput)).rejects.toThrow(
      "Add your Amazon Bedrock credentials",
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects personal session access by another user before credential reads or spend", async () => {
    const { session } = await createManagedAgentSession(context, managedAgentTestInput);
    const other = managedAgentTestContext(database, 99);
    const keys = vi.spyOn(other.repositories.userSettings, "getProviderApiKey");

    fetchMock.mockClear();
    await expect(retrieveManagedAgentSession(other, session.id)).rejects.toMatchObject({
      statusCode: 404,
    });
    await expect(deleteManagedAgentSession(other, session.id)).rejects.toMatchObject({
      statusCode: 404,
    });
    expect(keys).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rechecks workspace membership and restricts execution to owners and admins", async () => {
    await connectWorkspace();
    const { session } = await createManagedAgentSession(
      context,
      managedAgentTestInput,
      "project-1",
    );
    const member = managedAgentTestContext(database, 44);

    await expect(retrieveManagedAgentSession(member, session.id)).resolves.toMatchObject({
      session: { id: session.id },
    });
    fetchMock.mockClear();
    await expect(
      createManagedAgentSession(member, managedAgentTestInput, "project-1"),
    ).rejects.toMatchObject({ statusCode: 403 });
    await expect(
      submitManagedAgentMessage(member, session.id, { text: "Run commands" }),
    ).rejects.toMatchObject({ statusCode: 403 });
    await expect(cancelManagedAgentTurn(member, session.id)).rejects.toMatchObject({
      statusCode: 403,
    });
    await expect(deleteManagedAgentSession(member, session.id)).rejects.toMatchObject({
      statusCode: 403,
    });
    await expect(
      streamManagedAgentEvents(managedAgentTestContext(database, 99), session.id),
    ).rejects.toMatchObject({ statusCode: 404 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reads durable items and streams progress without forwarding upstream headers", async () => {
    const { session } = await createManagedAgentSession(context, managedAgentTestInput);

    fetchMock.mockResolvedValueOnce(
      Response.json({
        data: [{ id: "item_1", type: "message", content: [] }],
        has_more: false,
        first_id: "item_1",
        last_id: "item_1",
      }),
    );
    expect(await listManagedAgentItems(context, session.id, { limit: 100 })).toMatchObject({
      data: [{ id: "item_1" }],
    });
    fetchMock.mockResolvedValueOnce(
      new Response('data: {"type":"agent.session.turn.completed"}\n\n', {
        headers: { "Content-Type": "text/event-stream", Authorization: "upstream-secret" },
      }),
    );
    const response = await streamManagedAgentEvents(context, session.id);

    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(response.headers.get("authorization")).toBeNull();
    expect(await response.text()).toContain("turn.completed");
  });

  it("marks accepted-but-untracked creation as failed and cleans up the known upstream session", async () => {
    vi.spyOn(context.repositories.activities, "updateActivity").mockRejectedValueOnce(
      new Error("Persistence unavailable"),
    );
    fetchMock
      .mockResolvedValueOnce(Response.json(upstreamSession))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    await expect(createManagedAgentSession(context, managedAgentTestInput)).rejects.toThrow(
      "Persistence unavailable",
    );
    expect(lastRequest().method).toBe("DELETE");
    expect(lastRequest().url).toContain("sess_test");
    expect((await listManagedAgentSessions(context, {})).sessions[0]).toMatchObject({
      status: "failed",
      sessionId: null,
    });
  });

  it("retains failed tracking and avoids retries after ambiguous creation", async () => {
    fetchMock.mockRejectedValueOnce(new Error("Connection interrupted"));
    await expect(createManagedAgentSession(context, managedAgentTestInput)).rejects.toThrow(
      "Connection interrupted",
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect((await listManagedAgentSessions(context, {})).sessions[0]).toMatchObject({
      status: "failed",
      sessionId: null,
    });
  });

  it("cancels explicitly and deletes idempotently without presenting cancellation as rollback", async () => {
    const { session } = await createManagedAgentSession(context, managedAgentTestInput);

    fetchMock.mockResolvedValueOnce(new Response(null, { status: 202 }));
    expect(await cancelManagedAgentTurn(context, session.id)).toEqual({ accepted: true });
    expect((await listManagedAgentSessions(context, {})).sessions[0]?.status).toBe("waiting");
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 404 }));
    expect(await deleteManagedAgentSession(context, session.id)).toEqual({ deleted: true });
    fetchMock.mockClear();
    expect(await deleteManagedAgentSession(context, session.id)).toEqual({ deleted: true });
    await expect(
      submitManagedAgentMessage(context, session.id, { text: "Resume" }),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects a refreshed session that points to another runtime", async () => {
    const { session } = await createManagedAgentSession(context, managedAgentTestInput);

    fetchMock.mockResolvedValueOnce(
      Response.json({
        ...upstreamSession,
        environment: {
          ...upstreamSession.environment,
          runtime_arn: upstreamSession.environment.runtime_arn.replace(
            "test-runtime",
            "other-runtime",
          ),
        },
      }),
    );
    await expect(retrieveManagedAgentSession(context, session.id)).rejects.toMatchObject({
      statusCode: 409,
    });
  });

  it("enforces authentication and request validation at the HTTP boundary", async () => {
    const app = routeApp(null);
    const unauthenticated = await app.request("/agents/sessions", undefined, context.env);

    expect(unauthenticated.status).toBe(401);
    await connectWorkspace();
    const signedIn = routeApp();
    const invalid = await signedIn.request(
      "/agents/sessions?projectId=project-1",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...managedAgentTestInput,
          environment: {
            ...managedAgentTestInput.environment,
            runtime_arn: "https://attacker.example/",
          },
        }),
      },
      context.env,
    );

    expect(invalid.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
    const response = await signedIn.request(
      "/agents/sessions?projectId=project-1",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(managedAgentTestInput),
      },
      context.env,
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(await response.json()).toMatchObject({
      session: { projectId: "project-1", sessionId: "sess_test" },
    });
  });
});
