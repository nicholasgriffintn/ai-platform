import { describe, expect, it, vi } from "vitest";

import { WorkspaceRepository } from "../WorkspaceRepository";

describe("WorkspaceRepository", () => {
	it("uses ownership only for personal conversations and membership for project conversations", async () => {
		const calls: { params: unknown[]; query: string }[] = [];
		const database = {
			prepare: vi.fn((query: string) => ({
				bind: (...params: unknown[]) => ({
					first: vi.fn(async () => {
						calls.push({ query, params });
						return { allowed: 1 };
					}),
				}),
			})),
		};
		const repository = new WorkspaceRepository({ DB: database } as any);

		await expect(repository.canAccessConversation("conversation-1", 123)).resolves.toBe(true);

		expect(calls[0]?.query).toContain("c.project_id IS NULL AND c.user_id = access_user.id");
		expect(calls[0]?.query).toContain("access_user.plan_id = 'pro'");
		expect(calls[0]?.query).toContain("wm.user_id IS NOT NULL");
		expect(calls[0]?.params).toEqual([123, "conversation-1"]);
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

		expect(statements[0]?.query).toContain("UPDATE workspace_invitation");
		expect(statements[0]?.query).toContain("status = 'pending' AND token_hash = ?");
		expect(statements[0]?.params).toEqual([2, "invitation-1", "token-hash"]);
		expect(statements[1]?.query).toContain("INSERT INTO workspace_member");
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
});
