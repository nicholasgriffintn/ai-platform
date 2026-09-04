import { describe, expect, it, vi } from "vitest";

import { resolveProjectRouterMode } from "~/lib/chat/policy/project-routing";
import type { ServiceContext } from "~/lib/context/serviceContext";
import { ErrorType } from "~/utils/errors";

import { applyProjectCodingEnvironment, resolveProjectChatContext } from "../chatContext";
import {
  resolveAllowedProjectConnectorOperations,
  resolveProjectRecipeConnectorScope,
} from "../projectRecipeConnectorScope";

function createContext({
  conversation = null,
  membership = { role: "member" },
}: {
  conversation?: Record<string, unknown> | null;
  membership?: { role: "owner" | "admin" | "member" } | null;
} = {}) {
  const repositories = {
    conversations: {
      getConversation: vi.fn().mockResolvedValue(conversation),
    },
    workspaces: {
      getProject: vi.fn().mockResolvedValue({
        id: "project-1",
        workspace_id: "workspace-1",
        instructions: "Use the approved launch brief.",
        default_router_mode: "lite",
      }),
      getWorkspace: vi.fn().mockResolvedValue({ id: "workspace-1" }),
      getMembership: vi.fn().mockResolvedValue(membership),
      listProjectCapabilities: vi.fn().mockResolvedValue([
        { kind: "tool", capability_id: "web_search" },
        { kind: "recipe", capability_id: "launch-brief" },
        { kind: "skill", capability_id: "artifacts" },
      ]),
    },
  };
  const context = {
    requireUser: vi.fn().mockReturnValue({
      id: 7,
      email: "member@example.com",
      plan_id: "pro",
    }),
    repositories,
  } as unknown as ServiceContext;

  return { context, repositories };
}

describe("project chat context", () => {
  it("applies the saved routing tier to new and resumed project conversations", async () => {
    const fresh = createContext();

    await expect(
      resolveProjectRouterMode({
        context: fresh.context,
        metadata: { project_id: "project-1" },
        model_router_mode: "auto",
      }),
    ).resolves.toBe("lite");
    const resumed = createContext({ conversation: { project_id: "project-1" } });

    await expect(
      resolveProjectRouterMode({
        context: resumed.context,
        completion_id: "conversation-1",
      }),
    ).resolves.toBe("lite");
    await expect(
      resolveProjectRouterMode({
        context: resumed.context,
        completion_id: "conversation-1",
        model_router_mode: "max",
      }),
    ).resolves.toBe("max");
    resumed.repositories.workspaces.getProject.mockResolvedValue({
      id: "project-1",
      workspace_id: "workspace-1",
      instructions: "",
      default_router_mode: "auto",
    });
    await expect(
      resolveProjectRouterMode({
        context: resumed.context,
        completion_id: "conversation-1",
        model_router_mode: "auto",
      }),
    ).resolves.toBe("auto");
  });

  it("leaves personal routing and explicit project model choices alone", async () => {
    const { context, repositories } = createContext();

    await expect(resolveProjectRouterMode({ context, model_router_mode: "auto" })).resolves.toBe(
      "auto",
    );
    await expect(resolveProjectRouterMode({ context, model_router_mode: "pro" })).resolves.toBe(
      "pro",
    );
    for (const selection of [{ model: "chosen-model" }, { models: ["first", "second"] }]) {
      await expect(
        resolveProjectRouterMode({ context, metadata: { project_id: "project-1" }, ...selection }),
      ).resolves.toBe("auto");
    }

    expect(repositories.workspaces.getProject).not.toHaveBeenCalled();
  });

  it("rejects unauthorised and conflicting project scope before automatic routing", async () => {
    const outsider = createContext({ membership: null });

    await expect(
      resolveProjectRouterMode({
        context: outsider.context,
        metadata: { project_id: "project-1" },
        model_router_mode: "auto",
      }),
    ).rejects.toMatchObject({ type: ErrorType.NOT_FOUND, statusCode: 404 });
    const conflicting = createContext({ conversation: { project_id: "project-1" } });

    await expect(
      resolveProjectRouterMode({
        context: conflicting.context,
        completion_id: "conversation-1",
        metadata: { project_id: "project-2" },
      }),
    ).rejects.toMatchObject({ type: ErrorType.CONFLICT_ERROR, statusCode: 409 });
  });

  it("keeps the project repository fixed while allowing a conversation task type", () => {
    const options = applyProjectCodingEnvironment(
      {
        options: {
          sandbox: {
            enabled: true,
            installationId: 999,
            repo: "other/repository",
            model: "untrusted-model",
            taskType: "bug-fix",
          },
        },
      },
      {
        projectId: "project-1",
        instructions: "",
        enabledTools: [],
        enabledSkillIds: [],
        connectorProviders: [],
        sandboxOptions: {
          enabled: true,
          installationId: 123,
          repo: "owner/repository",
          taskType: "feature-implementation",
          promptStrategy: "auto",
          shouldCommit: true,
          timeoutSeconds: 900,
        },
      },
    );

    expect(options.options?.sandbox).toMatchObject({
      enabled: true,
      installationId: 123,
      repo: "owner/repository",
      taskType: "bug-fix",
    });
    expect(options.options?.sandbox?.model).toBeUndefined();
  });

  it("resolves instructions and tools from the authorised project", async () => {
    const { context } = createContext();

    await expect(
      resolveProjectChatContext(context, {
        completion_id: "new-conversation",
        metadata: { project_id: "project-1" },
      }),
    ).resolves.toEqual({
      projectId: "project-1",
      instructions: "Use the approved launch brief.",
      enabledTools: [
        "web_search",
        "code_execution",
        "search_grounding",
        "image_generation",
        "tool_search",
        "hosted_shell",
        "web_fetch",
        "create_task",
        "get_task",
        "list_tasks",
        "update_task",
      ],
      enabledSkillIds: ["artifacts"],
      connectorProviders: [],
      toolOptions: undefined,
      sandboxOptions: undefined,
    });
  });

  it("enables configuration-backed tools only from validated project settings", async () => {
    const { context, repositories } = createContext();

    repositories.workspaces.listProjectCapabilities.mockResolvedValue([
      {
        kind: "tool",
        capability_id: "file_search",
        configuration: JSON.stringify({ vectorStoreIds: ["vs_project"] }),
      },
      {
        kind: "tool",
        capability_id: "mcp",
        configuration: {
          servers: [{ label: "docs", url: "https://mcp.example.com" }],
        },
      },
    ]);

    const result = await resolveProjectChatContext(context, {
      metadata: { project_id: "project-1" },
    });

    expect(result?.enabledTools).toContain("file_search");
    expect(result?.enabledTools).toContain("mcp");
    expect(result?.toolOptions).toEqual({
      file_search: { vector_store_ids: ["vs_project"] },
      mcp_servers: [
        {
          require_approval: "always",
          server_label: "docs",
          server_url: "https://mcp.example.com/",
        },
      ],
    });
  });

  it("uses the stored project for an existing project conversation", async () => {
    const { context } = createContext({ conversation: { project_id: "project-1" } });

    const result = await resolveProjectChatContext(context, {
      completion_id: "conversation-1",
    });

    expect(result?.projectId).toBe("project-1");
  });

  it("allows only catalogue tools for a recipe enabled in the project", async () => {
    const { context, repositories } = createContext();

    repositories.workspaces.listProjectCapabilities.mockResolvedValue([
      { kind: "recipe", capability_id: "daily-weather" },
    ]);

    const result = await resolveProjectChatContext(context, {
      completion_id: "new-conversation",
      metadata: { project_id: "project-1" },
      enabled_tools: ["get_weather", "untrusted_tool"],
      options: { recipe: { id: "daily-weather" } },
    });

    expect(result?.enabledTools).toEqual([
      "code_execution",
      "search_grounding",
      "image_generation",
      "tool_search",
      "hosted_shell",
      "web_fetch",
      "create_task",
      "get_task",
      "list_tasks",
      "update_task",
      "get_weather",
    ]);
  });

  it("limits direct connector execution to providers and operations from project recipes", () => {
    const scope = resolveProjectRecipeConnectorScope([
      { kind: "recipe", capability_id: "email-assistant" },
      { kind: "recipe", capability_id: "unknown-recipe" },
      { kind: "tool", capability_id: "web_search" },
    ]);

    expect(scope.providers).toEqual(["gmail", "outlook"]);
    expect(scope.operationsByProvider.gmail).toEqual([
      "GMAIL_FETCH_EMAILS",
      "GMAIL_CREATE_EMAIL_DRAFT",
    ]);
    expect(scope.operationsByProvider.outlook).toEqual([
      "OUTLOOK_SEARCH_MESSAGES",
      "OUTLOOK_CREATE_DRAFT",
    ]);
  });

  it("projects only recipe-enabled connector providers into project chat", async () => {
    const { context, repositories } = createContext();

    repositories.workspaces.listProjectCapabilities.mockResolvedValue([
      { kind: "recipe", capability_id: "email-assistant" },
    ]);

    const result = await resolveProjectChatContext(context, {
      metadata: { project_id: "project-1" },
    });

    expect(result?.connectorProviders).toEqual(["gmail", "outlook"]);
  });

  it("fails closed when a project recipe has no explicit connector operation allowlist", () => {
    expect(
      resolveAllowedProjectConnectorOperations({
        projectScope: { providers: ["gmail"], operationsByProvider: {} },
        provider: "gmail",
        recipeOperations: undefined,
      }),
    ).toEqual([]);
  });

  it("rejects moving an existing personal conversation into a project", async () => {
    const { context } = createContext({ conversation: { project_id: null } });

    await expect(
      resolveProjectChatContext(context, {
        completion_id: "conversation-1",
        metadata: { project_id: "project-1" },
      }),
    ).rejects.toMatchObject({ type: ErrorType.CONFLICT_ERROR, statusCode: 409 });
  });

  it("does not disclose a project to users outside its workspace", async () => {
    const { context } = createContext({ membership: null });

    await expect(
      resolveProjectChatContext(context, {
        completion_id: "new-conversation",
        metadata: { project_id: "project-1" },
      }),
    ).rejects.toMatchObject({ type: ErrorType.NOT_FOUND, statusCode: 404 });
  });
});
