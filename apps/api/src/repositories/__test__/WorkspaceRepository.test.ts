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
});
