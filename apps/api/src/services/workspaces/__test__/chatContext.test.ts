import { describe, expect, it, vi } from "vitest";

import { resolveProjectModelTier } from "~/lib/chat/policy/project-model-tier";
import type { ServiceContext } from "~/lib/context/serviceContext";
import { getConversationBranches } from "~/services/completions/conversationThreads";
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
      listConversationThreads: vi.fn().mockResolvedValue([]),
    },
    workspaces: {
      getProject: vi.fn().mockResolvedValue({
        id: "project-1",
        workspace_id: "workspace-1",
        instructions: "Use the approved launch brief.",
        default_model_tier: "low",
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
    getUserSettings: vi.fn().mockResolvedValue(null),
    repositories,
  } as unknown as ServiceContext;

  return { context, repositories };
}

describe("project chat context", () => {
  it("applies the saved project tier to new and resumed project conversations", async () => {
    const fresh = createContext();

    await expect(
      resolveProjectModelTier({
        context: fresh.context,
        metadata: { project_id: "project-1" },
      }),
    ).resolves.toBe("low");
    const resumed = createContext({ conversation: { project_id: "project-1" } });

    await expect(
      resolveProjectModelTier({
        context: resumed.context,
        completion_id: "conversation-1",
      }),
    ).resolves.toBe("low");
    await expect(
      resolveProjectModelTier({
        context: resumed.context,
        completion_id: "conversation-1",
        model_tier: "ultra",
      }),
    ).resolves.toBe("ultra");
    resumed.repositories.workspaces.getProject.mockResolvedValue({
      id: "project-1",
      workspace_id: "workspace-1",
      instructions: "",
      default_model_tier: null,
    });
    await expect(
      resolveProjectModelTier({
        context: resumed.context,
        completion_id: "conversation-1",
      }),
    ).resolves.toBe("medium");
  });

  it("leaves personal tiers and explicit project model choices alone", async () => {
    const { context, repositories } = createContext();

    await expect(resolveProjectModelTier({ context })).resolves.toBe("medium");
    await expect(resolveProjectModelTier({ context, model_tier: "high" })).resolves.toBe("high");
    for (const selection of [{ model: "chosen-model" }, { models: ["first", "second"] }]) {
      await expect(
        resolveProjectModelTier({ context, metadata: { project_id: "project-1" }, ...selection }),
      ).resolves.toBe("medium");
    }

    expect(repositories.workspaces.getProject).not.toHaveBeenCalled();
  });

  it("rejects unauthorised and conflicting project scope before resolving a tier", async () => {
    const outsider = createContext({ membership: null });

    await expect(
      resolveProjectModelTier({
        context: outsider.context,
        metadata: { project_id: "project-1" },
      }),
    ).rejects.toMatchObject({ type: ErrorType.NOT_FOUND, statusCode: 404 });
    const conflicting = createContext({ conversation: { project_id: "project-1" } });

    await expect(
      resolveProjectModelTier({
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

describe("conversation branch access", () => {
  it("uses creator ownership for personal threads and membership for project threads", async () => {
    const personal = createContext({ conversation: { id: "c1", user_id: 7, project_id: null } });

    await getConversationBranches(personal.context, "c1");
    expect(personal.repositories.conversations.listConversationThreads).toHaveBeenCalledWith(
      "c1",
      7,
      null,
      201,
    );
    const project = createContext({
      conversation: { id: "c2", user_id: 99, project_id: "project-1" },
    });

    await getConversationBranches(project.context, "c2");
    expect(project.repositories.conversations.listConversationThreads).toHaveBeenCalledWith(
      "c2",
      7,
      "project-1",
      201,
    );
  });

  it("refuses foreign personal conversations and revoked workspace memberships", async () => {
    const personal = createContext({ conversation: { user_id: 99, project_id: null } });

    await expect(getConversationBranches(personal.context, "private")).rejects.toMatchObject({
      statusCode: 404,
    });
    expect(personal.repositories.conversations.listConversationThreads).not.toHaveBeenCalled();
    const project = createContext({
      conversation: { user_id: 7, project_id: "project-1" },
      membership: null,
    });

    await expect(getConversationBranches(project.context, "project-chat")).rejects.toMatchObject({
      statusCode: 404,
    });
    expect(project.repositories.conversations.listConversationThreads).not.toHaveBeenCalled();
  });

  it("bounds large trees, retains the current branch, and hides omitted parent identifiers", async () => {
    const { context, repositories } = createContext({ conversation: { id: "c200", user_id: 7 } });

    repositories.conversations.listConversationThreads.mockResolvedValue(
      Array.from({ length: 201 }, (_, index) => ({
        id: `c${index}`,
        title: `Branch ${index}`,
        parent_conversation_id: "outside-scope",
        created_at: "2026-09-01",
        is_archived: 1,
      })),
    );
    const result = await getConversationBranches(context, "c200");

    expect(result.truncated).toBe(true);
    expect(result.threads).toHaveLength(200);
    expect(result.threads.some((thread) => thread.id === "c200")).toBe(true);
    expect(
      result.threads.every(
        (thread) => thread.parent_conversation_id === null && thread.is_archived,
      ),
    ).toBe(true);
  });
});
