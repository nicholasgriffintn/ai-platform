import { currentFundingWorkspaceId } from "@ngriffin_uk/polychat-ai-billing";
import { ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import { describe, expect, it, vi } from "vitest";

import { fakeRepositories } from "~/infrastructure/database/__test__/fake-repositories";
import { ConversationRepository } from "~/modules/conversations/infrastructure/ConversationRepository";
import { WorkspacePoolRepository } from "~/modules/usage/infrastructure/WorkspacePoolRepository";
import { WorkspaceRepository } from "~/modules/workspaces/infrastructure/WorkspaceRepository";

import {
  resolveWorkspaceFunding,
  withProjectFunding,
  withWorkspaceFunding,
} from "../workspace-funding";

function createRepositories(params: {
  conversationProjectId?: string | null;
  pool?: object | null;
  role?: string | null;
}) {
  return fakeRepositories([
    [
      ConversationRepository,
      {
        getConversation: vi.fn().mockResolvedValue({
          project_id: params.conversationProjectId ?? null,
        }),
      },
    ],
    [
      WorkspaceRepository,
      {
        getProject: vi.fn().mockResolvedValue({ workspace_id: "workspace-1" }),
        getMembership: vi.fn().mockResolvedValue(params.role ? { role: params.role } : null),
      },
    ],
    [WorkspacePoolRepository, { getPool: vi.fn().mockResolvedValue(params.pool ?? null) }],
  ]);
}

describe("resolveWorkspaceFunding", () => {
  it("funds a seated member's project conversation from the workspace", async () => {
    const repositories = createRepositories({
      conversationProjectId: "project-1",
      pool: {},
      role: "member",
    });

    await expect(
      resolveWorkspaceFunding(repositories, { userId: 7, conversationId: "conversation-1" }),
    ).resolves.toBe("workspace-1");
  });

  it("trusts the stored project over the one a request names", async () => {
    const repositories = createRepositories({
      conversationProjectId: null,
      pool: {},
      role: "member",
    });

    await expect(
      resolveWorkspaceFunding(repositories, {
        userId: 7,
        conversationId: "personal",
        projectId: "project-1",
      }),
    ).resolves.toBeNull();
  });

  it("leaves workspaces without a team plan on members' own accounts", async () => {
    const repositories = createRepositories({ pool: null, role: "member" });

    await expect(
      resolveWorkspaceFunding(repositories, { userId: 7, projectId: "project-1" }),
    ).resolves.toBeNull();
  });

  it("refuses a draw from someone without a seat", async () => {
    const repositories = createRepositories({ pool: {}, role: null });

    await expect(
      resolveWorkspaceFunding(repositories, { userId: 7, projectId: "project-1" }),
    ).rejects.toMatchObject({ type: ErrorType.FORBIDDEN, statusCode: 403 });
  });
});

describe("withProjectFunding", () => {
  it("keeps background work on the pool after the member who started it has left", async () => {
    const repositories = createRepositories({ pool: {}, role: null });

    await expect(
      withProjectFunding(repositories, { projectId: "project-1" }, async () =>
        currentFundingWorkspaceId(),
      ),
    ).resolves.toBe("workspace-1");
  });

  it("opens no scope for personal work or a workspace without a team plan", async () => {
    const repositories = createRepositories({ pool: null, role: "member" });
    const read = async () => currentFundingWorkspaceId();

    await expect(withProjectFunding(repositories, {}, read)).resolves.toBeUndefined();
    await expect(
      withProjectFunding(repositories, { projectId: "project-1" }, read),
    ).resolves.toBeUndefined();
  });
});

describe("withWorkspaceFunding", () => {
  it("only opens a funding scope for a funded workspace", () => {
    expect(withWorkspaceFunding("workspace-1", currentFundingWorkspaceId)).toBe("workspace-1");
    expect(withWorkspaceFunding(null, currentFundingWorkspaceId)).toBeUndefined();
  });
});
