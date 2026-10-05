import { describe, expect, it, vi } from "vitest";

import { WorkspaceRepository } from "../WorkspaceRepository";

describe("WorkspaceRepository", () => {
  it("lists only user-facing project conversation types", async () => {
    const calls: { params: unknown[]; query: string }[] = [];
    const database = {
      prepare: vi.fn((query: string) => ({
        bind: (...params: unknown[]) => ({
          all: vi.fn(async () => {
            calls.push({ query, params });

            return { results: [] };
          }),
        }),
      })),
    };
    const repository = new WorkspaceRepository({ DB: database } as any);

    await repository.listProjectConversations("project-1", 123);

    expect(calls[0]?.query).toContain("c.type IN ('chat', 'task')");
    expect(calls[0]?.params).toEqual([123, "project-1", 123]);
  });

  it("denies access when no row is found for the conversation", async () => {
    const database = {
      prepare: vi.fn(() => ({
        bind: () => ({
          first: vi.fn(async () => null),
        }),
      })),
    };
    const repository = new WorkspaceRepository({ DB: database } as any);

    await expect(repository.canAccessConversation("conversation-1", 123)).resolves.toBe(false);
  });

  it("consumes an invitation before granting membership", async () => {
    const statements: { query: string; params: unknown[] }[] = [];
    const database = {
      prepare: vi.fn((query: string) => ({
        bind: (...params: unknown[]) => {
          const statement = { query, params };

          statements.push(statement);

          return statement;
        },
      })),
      batch: vi.fn(async () => [
        { success: true, meta: { changes: 1 } },
        { success: true, meta: { changes: 1 } },
      ]),
    };
    const repository = new WorkspaceRepository({ DB: database } as any);

    await repository.acceptInvitation(
      {
        id: "invitation-1",
        workspace_id: "workspace-1",
        email: "member@example.com",
        role: "member",
        token_hash: "token-hash",
        status: "pending",
        invited_by: 1,
        accepted_by: null,
        expires_at: "2026-08-18T00:00:00.000Z",
        accepted_at: null,
        created_at: "2026-08-11T00:00:00.000Z",
        updated_at: null,
      },
      2,
    );

    expect(statements[0]?.query).toContain("UPDATE resource_grant");
    expect(statements[0]?.query).toContain("kind = 'invitation'");
    expect(statements[0]?.query).toContain("status = 'pending' AND token_hash = ?");
    expect(statements[0]?.params).toEqual([2, "invitation-1", "token-hash"]);
    expect(statements[1]?.query).toContain("INSERT INTO resource_grant");
    expect(statements[1]?.query).toContain("SELECT 'membership'");
    expect(statements[1]?.query).toContain("AND changes() = 1");
    expect(statements[1]?.query).toContain("accepted_by = ?");
  });

  it("rejects an invitation that lost the consumption race", async () => {
    const database = {
      prepare: vi.fn((query: string) => ({
        bind: (...params: unknown[]) => ({ query, params }),
      })),
      batch: vi.fn(async () => [
        { success: true, meta: { changes: 0 } },
        { success: true, meta: { changes: 0 } },
      ]),
    };
    const repository = new WorkspaceRepository({ DB: database } as any);

    await expect(
      repository.acceptInvitation(
        {
          id: "invitation-1",
          workspace_id: "workspace-1",
          email: "member@example.com",
          role: "member",
          token_hash: "token-hash",
          status: "pending",
          invited_by: 1,
          accepted_by: null,
          expires_at: "2026-08-18T00:00:00.000Z",
          accepted_at: null,
          created_at: "2026-08-11T00:00:00.000Z",
          updated_at: null,
        },
        2,
      ),
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it("stores a project capability and its configuration in one guarded write", async () => {
    const run = vi.fn(async () => ({ success: true, meta: { changes: 1 } }));
    const bind = vi.fn(() => ({ run }));
    const prepare = vi.fn((_query: string) => ({ bind }));
    const repository = new WorkspaceRepository({ DB: { prepare } } as any);

    await repository.addProjectCapability({
      id: "association-1",
      projectId: "project-1",
      kind: "tool",
      capabilityId: "file_search",
      configuration: { vectorStoreIds: ["vs_project"] },
      createdBy: 42,
    });

    expect(run).toHaveBeenCalledOnce();
    expect(prepare.mock.calls[0]?.[0]).toContain(
      "scoped_configuration.created_by = excluded.created_by",
    );
    expect(bind).toHaveBeenCalledWith(
      "association-1",
      "project-1",
      "tool",
      "file_search",
      JSON.stringify({ vectorStoreIds: ["vs_project"] }),
      42,
      0,
    );
  });

  it("deletes project-scoped capability configuration with its workspace", async () => {
    const statements: { query: string; params: unknown[] }[] = [];
    const database = {
      prepare: vi.fn((query: string) => ({
        bind: (...params: unknown[]) => {
          const statement = { query, params };

          statements.push(statement);

          return statement;
        },
      })),
      batch: vi.fn(async () => []),
    };
    const repository = new WorkspaceRepository({ DB: database } as any);

    await repository.deleteWorkspace("workspace-1");

    const capabilityConfigurationDelete = statements.find(({ query }) =>
      query.includes("DELETE FROM scoped_configuration"),
    );

    expect(capabilityConfigurationDelete?.query).toContain("project_id IN");
    expect(capabilityConfigurationDelete?.params).toEqual(["workspace-1"]);
    const usageUpdate = statements.find(({ query }) => query.includes("UPDATE usage_event"));

    expect(usageUpdate?.query).toContain("workspace_id = NULL, project_id = NULL");
    expect(usageUpdate?.params).toEqual(["workspace-1"]);
  });
});
