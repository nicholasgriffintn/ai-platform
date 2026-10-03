import { readFile } from "node:fs/promises";

import type { D1Database } from "@cloudflare/workers-types";
import { getModelConfigById } from "@ngriffin_uk/polychat-ai-models";
import { PermissionChecker, toToolDeclaration } from "@ngriffin_uk/polychat-library-tools";
import { computerUseInputSchema } from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import { Miniflare } from "miniflare";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import z from "zod/v4";

import {
  createServiceContext,
  withExecutionRunContext,
  type ServiceContext,
} from "~/infrastructure/context/serviceContext";
import {
  hasUserProviderApiKey,
  resolveProviderApiKey,
} from "~/infrastructure/providers/credentials";
import { use_computer } from "~/modules/functions/application/use_computer";
import * as teammateContexts from "~/modules/teammates/application/contexts";
import {
  requireProjectAccess,
  requireProjectCapabilityAccess,
  requireWorkspaceAccess,
} from "~/modules/workspaces/application/access";
import { browserTestUser, browserTestApproval, computerTestRun } from "~/test-utils/computer-use";
import { databaseTestEnvironment } from "~/test-utils/environment";
import type { IEnv } from "~/types";

import { getBrowserAvailability, getComputerUseAvailability, resolveBrowserApiKey } from "./access";
import {
  destroyBrowserSession,
  inspectBrowserSession,
  respondToBrowserApproval,
  startBrowserSession,
} from "./sessions";

vi.mock("~/infrastructure/providers/credentials", () => ({
  hasUserProviderApiKey: vi.fn(),
  resolveProviderApiKey: vi.fn(),
}));
vi.mock("~/modules/models/application/resolve", () => ({
  getModelConfig: vi.fn(async () => getModelConfigById("gpt-6-astra")),
}));
vi.mock("~/modules/workspaces/application/access", async (importOriginal) => ({
  ...(await importOriginal<typeof import("~/modules/workspaces/application/access")>()),
  requireProjectAccess: vi.fn(),
  requireWorkspaceAccess: vi.fn(),
  requireProjectCapabilityAccess: vi.fn(),
}));

const runtime = new Miniflare({
  modules: true,
  script: "export default { fetch() { return new Response('test'); } }",
  compatibilityDate: "2026-08-01",
  d1Databases: ["DB"],
});
let database: D1Database;
let context: ServiceContext;

beforeAll(async () => {
  database = await runtime.getD1Database("DB");
  await database.batch([
    database.prepare("CREATE TABLE user (id INTEGER PRIMARY KEY)"),
    database.prepare("CREATE TABLE workspace (id TEXT PRIMARY KEY)"),
    database.prepare(
      "CREATE TABLE conversation (id TEXT PRIMARY KEY, user_id INTEGER, project_id TEXT)",
    ),
    database.prepare("INSERT INTO user VALUES (1), (2)"),
    database.prepare("INSERT INTO workspace VALUES ('workspace')"),
    database.prepare("INSERT INTO conversation VALUES ('conversation', 1, NULL)"),
  ]);
  const migration = await readFile(
    new URL("../../../../migrations/0056_browser_sessions.sql", import.meta.url),
    "utf8",
  );

  for (const statement of migration.split("--> statement-breakpoint")) {
    if (statement.trim()) {
      await database.prepare(statement).run();
    }
  }
});
afterAll(() => runtime.dispose());
beforeEach(async () => {
  vi.restoreAllMocks();
  vi.resetAllMocks();
  vi.unstubAllGlobals();
  await database.prepare("DELETE FROM browser_session").run();
  context = createServiceContext({ env: databaseTestEnvironment(database), user: browserTestUser });
  vi.spyOn(context.repositories.conversations, "getConversation").mockResolvedValue({
    id: "conversation",
    user_id: 1,
    project_id: null,
  });
  vi.spyOn(context.repositories.teammateContexts, "getByHomeConversationId").mockResolvedValue(
    null,
  );
  vi.mocked(hasUserProviderApiKey).mockResolvedValue(true);
  vi.mocked(resolveProviderApiKey).mockResolvedValue("personal-key");
  vi.spyOn(context.repositories.modelConnections, "getSecrets").mockResolvedValue({});
  vi.mocked(requireWorkspaceAccess).mockResolvedValue({
    role: "member",
    workspace: {
      id: "workspace",
      name: "Workspace",
      description: "",
      colour: "#000000",
      created_by: 1,
      created_at: "2026-10-02T00:00:00Z",
      updated_at: null,
    },
  });
  vi.mocked(requireProjectAccess).mockResolvedValue({
    role: "member",
    project: {
      id: "project",
      workspace_id: "workspace",
      name: "Project",
      description: "",
      instructions: "",
      colour: "#000000",
      created_by: 1,
      archived_at: null,
      created_at: "2026-10-02T00:00:00Z",
      updated_at: null,
      conversation_count: 1,
      capability_count: 1,
    },
  });
});

describe("browser session ownership and lifecycle", () => {
  it("runs an OpenAI task through the common computer tool for a non-premium user", async () => {
    const user = { ...browserTestUser, plan_id: "free" };
    const serviceContext = createServiceContext({ env: context.env, user });
    const fetch = vi.fn(async () => Response.json({ id: "native", status: "idle" }));

    vi.spyOn(serviceContext.repositories.conversations, "getConversation").mockResolvedValue({
      id: "conversation",
      user_id: 1,
      project_id: null,
    });
    vi.spyOn(
      serviceContext.repositories.teammateContexts,
      "getByHomeConversationId",
    ).mockResolvedValue(null);
    vi.stubGlobal("fetch", fetch);
    expect(
      new PermissionChecker().checkToolAccess({
        toolName: use_computer.name,
        toolType: use_computer.type,
        toolPermissions: use_computer.permissions,
        user,
        mode: "build",
      }).allowed,
    ).toBe(true);
    const result = await use_computer.execute(
      { provider: "openai", operation: "start", task: "Read the public issues" },
      {
        completionId: "conversation",
        toolCallId: "common-call",
        env: context.env,
        request: {
          env: context.env,
          user,
          context: serviceContext,
          request: { completion_id: "conversation", input: "Read the page", date: "2026-10-03" },
        },
      },
    );

    expect(result).toMatchObject({
      name: "use_computer",
      status: "pending",
      data: { renderer: "browser_session" },
    });
    expect(fetch).toHaveBeenCalledOnce();
  });

  it("blocks built-in control for non-premium users through the common tool", async () => {
    const user = { ...browserTestUser, plan_id: "free" };
    const serviceContext = withExecutionRunContext(
      createServiceContext({ env: context.env, user }),
      "run",
      1,
    );
    const fetch = vi.fn();

    vi.stubGlobal("fetch", fetch);
    await expect(
      use_computer.execute(
        { operation: "observe" },
        {
          completionId: "conversation",
          env: context.env,
          request: {
            env: context.env,
            user,
            context: serviceContext,
            request: {
              teammate_context_id: "teammate-context",
              completion_id: "conversation",
              input: "Read the page",
              date: "2026-10-03",
            },
          },
        },
      ),
    ).rejects.toMatchObject({ statusCode: 403 });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("rejects unsupported provider operations before execution", () => {
    expect(
      computerUseInputSchema.safeParse({
        provider: "openai",
        operation: "input",
        input: { type: "read" },
      }).success,
    ).toBe(false);
    expect(
      computerUseInputSchema.safeParse({
        provider: "hosted",
        operation: "destroy",
        sessionId: "native",
      }).success,
    ).toBe(false);
  });

  it("publishes a usable declaration for both provider modes", () => {
    const declaration = toToolDeclaration(use_computer);
    const schema = z.fromJSONSchema(declaration.function.parameters);

    expect(
      schema.safeParse({ provider: "openai", operation: "start", task: "Read the page" }).success,
    ).toBe(true);
    expect(schema.safeParse({ provider: "hosted", operation: "read" }).success).toBe(true);
  });

  it("makes the built-in provider available without an OpenAI connection", async () => {
    context.env.COMPUTER_WORKER = Object.assign(async () => ({}), {
      fetch: vi.fn<NonNullable<IEnv["COMPUTER_WORKER"]>["fetch"]>(),
      connect: () => {
        throw new Error("Unexpected connection");
      },
      queue: async () => {
        throw new Error("Unexpected queue");
      },
      scheduled: async () => {
        throw new Error("Unexpected schedule");
      },
    });
    vi.mocked(hasUserProviderApiKey).mockResolvedValue(false);

    await expect(getComputerUseAvailability(context)).resolves.toMatchObject({
      available: true,
      providers: [
        { provider: "hosted", available: true, mode: "interactive" },
        { provider: "openai", available: false, mode: "managed" },
      ],
    });
  });

  it("operates the built-in worker with the active fenced lease through the common tool", async () => {
    const fetch = vi
      .fn<NonNullable<IEnv["COMPUTER_WORKER"]>["fetch"]>()
      .mockResolvedValue(Response.json({ text: "Visible page", width: 1440, height: 900 }));

    context.env.COMPUTER_WORKER = Object.assign(async () => ({}), {
      fetch,
      connect: () => {
        throw new Error("Unexpected connection");
      },
      queue: async () => {
        throw new Error("Unexpected queue");
      },
      scheduled: async () => {
        throw new Error("Unexpected schedule");
      },
    });
    vi.spyOn(teammateContexts, "requireTeammateContext").mockResolvedValue({
      id: "teammate-context",
      teammateId: "teammate",
      actorUserId: 1,
      scope: { type: "personal", id: "1" },
      homeConversationId: "conversation",
      memoryDocumentId: "memory",
      status: "active",
      createdAt: "2026-10-03",
      updatedAt: null,
    });
    vi.spyOn(context.repositories.conversationRuns, "getById").mockResolvedValue(computerTestRun);
    const computer = {
      id: "computer",
      contextId: "teammate-context",
      provider: "hosted",
      providerHandle: "worker",
      leaseFence: 1,
      checkpointReference: null,
      status: "ready" as const,
      lease: {
        kind: "agent" as const,
        ownerId: "run:run",
        fence: 1,
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
      },
      lastError: null,
      createdAt: "2026-10-03",
      updatedAt: null,
    };

    vi.spyOn(context.repositories.teammateComputers, "ensure").mockResolvedValue(computer);
    vi.spyOn(context.repositories.teammateComputers, "acquireLease").mockResolvedValue(computer);
    const serviceContext = withExecutionRunContext(context, "run", 1);
    const result = await use_computer.execute(
      { operation: "read" },
      {
        completionId: "conversation",
        toolCallId: "computer-call",
        env: context.env,
        request: {
          env: context.env,
          user: browserTestUser,
          context: serviceContext,
          request: {
            teammate_context_id: "teammate-context",
            completion_id: "conversation",
            input: "Read the page",
            date: "2026-10-03",
          },
        },
      },
    );

    expect(result).toMatchObject({
      name: "use_computer",
      status: "success",
      data: { renderer: "computer_observation", text: "Visible page" },
    });
    expect(JSON.parse(String(fetch.mock.calls[0][1]?.body))).toMatchObject({
      resourceId: "computer",
      handle: "worker",
      fence: 1,
      input: { type: "read" },
    });
  });

  it("rejects a revoked project grant before using the built-in worker", async () => {
    vi.spyOn(teammateContexts, "requireTeammateContext").mockResolvedValue({
      id: "teammate-context",
      teammateId: "teammate",
      actorUserId: 1,
      scope: { type: "project", id: "project" },
      homeConversationId: "conversation",
      memoryDocumentId: "memory",
      status: "active",
      createdAt: "2026-10-03",
      updatedAt: null,
    });
    vi.mocked(requireProjectCapabilityAccess).mockRejectedValueOnce(
      new AssistantError("Grant revoked", ErrorType.FORBIDDEN, 403),
    );
    const serviceContext = withExecutionRunContext(context, "run", 1);

    await expect(
      use_computer.execute(
        { provider: "hosted", operation: "start" },
        {
          completionId: "conversation",
          env: context.env,
          request: {
            env: context.env,
            user: browserTestUser,
            context: serviceContext,
            request: {
              teammate_context_id: "teammate-context",
              completion_id: "conversation",
              input: "Read the page",
              date: "2026-10-03",
            },
          },
        },
      ),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it("rejects supervised takeover from an obsolete run attempt before releasing its lease", async () => {
    vi.spyOn(teammateContexts, "requireTeammateContext").mockResolvedValue({
      id: "teammate-context",
      teammateId: "teammate",
      actorUserId: 1,
      scope: { type: "personal", id: "1" },
      homeConversationId: "conversation",
      memoryDocumentId: "memory",
      status: "active",
      createdAt: "2026-10-03",
      updatedAt: null,
    });
    vi.spyOn(context.repositories.conversationRuns, "getById").mockResolvedValue({
      ...computerTestRun,
      attempt: 2,
    });
    const ensure = vi.spyOn(context.repositories.teammateComputers, "ensure");
    const serviceContext = withExecutionRunContext(context, "run", 1);

    await expect(
      use_computer.execute(
        { provider: "hosted", operation: "request_takeover", reason: "Sign in" },
        {
          completionId: "conversation",
          toolCallId: "computer-call",
          env: context.env,
          request: {
            env: context.env,
            user: browserTestUser,
            context: serviceContext,
            request: {
              teammate_context_id: "teammate-context",
              completion_id: "conversation",
              input: "Read the page",
              date: "2026-10-03",
            },
          },
        },
      ),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(ensure).not.toHaveBeenCalled();
  });

  it("creates one remote task when the same tool call starts concurrently", async () => {
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValue(Response.json({ id: "native", status: "idle" }));

    vi.stubGlobal("fetch", fetch);
    const input = { operation: "start" as const, task: "Read the public issues" };
    const [first, second] = await Promise.all([
      startBrowserSession(context, input, "conversation", "call"),
      startBrowserSession(context, input, "conversation", "call"),
    ]);

    expect(first).toBe(second);
    expect(fetch).toHaveBeenCalledOnce();
    expect((await context.repositories.browserSessions.get(first))?.provider_session_id).toBe(
      "native",
    );
    await expect(
      startBrowserSession(context, { ...input, task: "Different task" }, "conversation", "call"),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(fetch).toHaveBeenCalledOnce();
  });
  it("recovers a timed-out creation without repeating the browser task", async () => {
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockRejectedValueOnce(new Error("Connection lost"));

    vi.stubGlobal("fetch", fetch);
    const input = { operation: "start" as const, task: "Read issues" };
    const id = await startBrowserSession(context, input, "conversation", "call");

    await startBrowserSession(context, input, "conversation", "call");
    expect(fetch).toHaveBeenCalledOnce();
    fetch.mockImplementation(async (request) => {
      const url = new URL(String(request));

      if (url.pathname === "/v1/agents/sessions") {
        return Response.json({
          data: [
            {
              id: "original",
              status: "in_progress",
              metadata: { polychat_browser_session_id: id },
            },
          ],
          has_more: false,
          last_id: "original",
        });
      }

      if (url.pathname.endsWith("/turns")) {
        return Response.json({ data: [{ id: "root", status: "in_progress", subagent_id: null }] });
      }

      if (url.pathname.endsWith("/items")) {
        return Response.json({ data: [], has_more: false, last_id: null });
      }

      return Response.json({ id: "original", status: "in_progress" });
    });
    await expect(inspectBrowserSession(context, id)).resolves.toMatchObject({
      id,
      status: "running",
    });
    expect((await context.repositories.browserSessions.get(id))?.provider_session_id).toBe(
      "original",
    );
    expect(fetch.mock.calls.filter((call) => call[1]?.method === "POST")).toHaveLength(1);
  });
  it("blocks other users before contacting OpenAI", async () => {
    const record = await context.repositories.browserSessions.reserve({
      id: "foreign",
      user_id: 2,
      conversation_id: "conversation",
      workspace_id: null,
      provider: "openai",
      credential_source: "user",
      tool_call_id: "call",
      model: "gpt-6-astra",
      input_hash: "hash",
    });
    const fetch = vi.fn<typeof globalThis.fetch>();

    vi.stubGlobal("fetch", fetch);
    await expect(inspectBrowserSession(context, record.id)).rejects.toMatchObject({
      statusCode: 404,
    });
    await expect(destroyBrowserSession(context, record.id)).rejects.toMatchObject({
      statusCode: 404,
    });
    expect(fetch).not.toHaveBeenCalled();
  });
  it("rejects a pending session after its conversation moves to another scope", async () => {
    await context.repositories.browserSessions.reserve({
      id: "scoped",
      user_id: 1,
      conversation_id: "conversation",
      workspace_id: "workspace",
      provider: "openai",
      credential_source: "workspace",
      tool_call_id: "call",
      model: "gpt-6-astra",
      input_hash: "hash",
    });
    await expect(inspectBrowserSession(context, "scoped")).rejects.toMatchObject({
      statusCode: 403,
    });
  });
  it("cancels an active task before deleting its provider session and revokes local access", async () => {
    await context.repositories.browserSessions.reserve({
      id: "closing",
      user_id: 1,
      conversation_id: "conversation",
      workspace_id: null,
      provider: "openai",
      credential_source: "user",
      tool_call_id: "closing-call",
      model: "gpt-6-astra",
      input_hash: "hash",
    });
    await context.repositories.browserSessions.bind("closing", "native");
    const fetch = vi.fn<typeof globalThis.fetch>(async (request, options) => {
      if (options?.method === "POST" || options?.method === "DELETE") {
        return new Response(null, { status: 202 });
      }

      if (String(request).includes("/turns?")) {
        return Response.json({ data: [{ id: "root", status: "in_progress", subagent_id: null }] });
      }

      if (String(request).includes("/items?")) {
        return Response.json({ data: [], has_more: false, last_id: null });
      }

      return Response.json({ id: "native", status: "in_progress" });
    });

    vi.stubGlobal("fetch", fetch);
    await expect(destroyBrowserSession(context, "closing")).resolves.toEqual({ destroyed: true });
    const writes = fetch.mock.calls.filter(
      (call) => call[1]?.method === "POST" || call[1]?.method === "DELETE",
    );

    expect(writes.map((call) => call[1]?.method)).toEqual(["POST", "DELETE"]);
    expect(JSON.parse(String(writes[0][1]?.body))).toEqual({
      events: [{ type: "agent.session.input.cancel" }],
    });
    await expect(inspectBrowserSession(context, "closing")).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  it("rejects stale approvals without submitting credentials", async () => {
    await context.repositories.browserSessions.reserve({
      id: "local",
      user_id: 1,
      conversation_id: "conversation",
      workspace_id: null,
      provider: "openai",
      credential_source: "user",
      tool_call_id: "call",
      model: "gpt-6-astra",
      input_hash: "hash",
    });
    await context.repositories.browserSessions.bind("local", "native");
    const fetch = vi.fn<typeof globalThis.fetch>(async (request) => {
      if (String(request).includes("/turns?")) {
        return Response.json({ data: [{ id: "turn-root", status: "waiting", subagent_id: null }] });
      }

      if (String(request).includes("/items?")) {
        return Response.json({ data: [], has_more: false, last_id: null });
      }

      return Response.json({
        id: "native",
        status: "requires_action",
        required_actions: [
          {
            type: "computer_use_approval_request",
            request_id: browserTestApproval.requestId,
            turn_id: browserTestApproval.turnId,
            request: browserTestApproval.request,
          },
        ],
      });
    });

    vi.stubGlobal("fetch", fetch);
    await expect(
      respondToBrowserApproval(context, "local", {
        requestId: "stale",
        response: { type: "browser_authentication", action: "cancel" },
      }),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(fetch.mock.calls.some((call) => call[1]?.method === "POST")).toBe(false);
  });
});

describe("browser credential authority", () => {
  it("offers workspace use without a personal key and pins the credential source", async () => {
    vi.mocked(hasUserProviderApiKey).mockResolvedValue(false);
    vi.spyOn(context.repositories.modelConnections, "getSecrets").mockResolvedValue({
      apiKey: "workspace-key",
    });
    await expect(getBrowserAvailability(context, undefined, "workspace")).resolves.toMatchObject({
      available: true,
      credentialSource: "workspace",
    });
    await expect(resolveBrowserApiKey(context, "workspace", "workspace")).resolves.toBe(
      "workspace-key",
    );
    expect(resolveProviderApiKey).not.toHaveBeenCalled();
  });
  it("does not substitute platform or personal credentials after a workspace key is removed", async () => {
    await expect(resolveBrowserApiKey(context, "workspace", "workspace")).rejects.toMatchObject({
      statusCode: 409,
    });
    expect(resolveProviderApiKey).not.toHaveBeenCalled();
    await resolveBrowserApiKey(context, "user", null);
    expect(resolveProviderApiKey).toHaveBeenCalledWith(
      expect.objectContaining({ credentialAuthority: "byok", userId: 1 }),
    );
  });
  it("rejects a workspace connection before reading its secrets when membership is absent", async () => {
    vi.mocked(requireWorkspaceAccess).mockRejectedValue(
      new AssistantError("Workspace not found", ErrorType.NOT_FOUND, 404),
    );
    await expect(getBrowserAvailability(context, undefined, "workspace")).rejects.toMatchObject({
      statusCode: 404,
    });
    expect(context.repositories.modelConnections.getSecrets).not.toHaveBeenCalled();
  });
});
