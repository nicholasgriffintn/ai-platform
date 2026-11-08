import { ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import { describe, expect, it, vi } from "vitest";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { fakeRepositories } from "~/infrastructure/database/__test__/fake-repositories";
import { getConversationBranches } from "~/modules/conversations/application/conversationThreads";
import { ConversationRepository } from "~/modules/conversations/infrastructure/ConversationRepository";
import { WorkspaceRepository } from "~/modules/workspaces/infrastructure/WorkspaceRepository";

import { applyProjectCodingEnvironment, resolveProjectChatContext } from "../chatContext";
import "~/tools";

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
    repositories: fakeRepositories([
      [ConversationRepository, repositories.conversations],
      [WorkspaceRepository, repositories.workspaces],
    ]),
  } as unknown as ServiceContext;

  return { context, repositories };
}

describe("project chat context", () => {
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
        workspaceId: "workspace-1",
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

  it("rejects moving an existing personal conversation into a project", async () => {
    const { context } = createContext({ conversation: { project_id: null } });

    await expect(
      resolveProjectChatContext(context, {
        completion_id: "conversation-1",
        metadata: { project_id: "project-1" },
      }),
    ).rejects.toMatchObject({ type: ErrorType.CONFLICT_ERROR, statusCode: 409 });
  });
});

describe("conversation branch access", () => {
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
});
