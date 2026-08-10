import { describe, expect, it, vi } from "vitest";

import { DynamicAppResponseRepository } from "../DynamicAppResponseRepository";

function createRepository(firstResult: unknown = null) {
	const all = vi.fn().mockResolvedValue({ results: [] });
	const first = vi.fn().mockResolvedValue(firstResult);
	const run = vi.fn().mockResolvedValue({ success: true });
	const bind = vi.fn().mockReturnValue({ all, first, run });
	const prepare = vi.fn().mockReturnValue({ bind });

	const repository = new DynamicAppResponseRepository({
		DB: {
			prepare,
		},
	} as any);

	return {
		bind,
		prepare,
		repository,
	};
}

describe("DynamicAppResponseRepository", () => {
	it("persists project scope with a dynamic app response", async () => {
		const { bind, prepare, repository } = createRepository({ id: "response-1" });

		await repository.createResponse(42, "research", { result: "done" }, "run-1", "project-1");

		expect(prepare.mock.calls[0][0]).toContain("project_id");
		expect(bind.mock.calls[0]).toContain("project-1");
	});

	it("scopes response lookup to the owning user", async () => {
		const { bind, prepare, repository } = createRepository();

		await repository.getResponseByIdForUser("response-1", 42);

		const query = prepare.mock.calls[0][0] as string;
		expect(query).toContain("FROM app_data");
		expect(query).toContain("id = ?");
		expect(query).toContain("user_id = ?");
		expect(query).toContain("item_type = ?");
		expect(bind).toHaveBeenCalledWith("response-1", 42, "dynamic_app_response");
	});

	it("scopes collaborative response lookup to the project", async () => {
		const { bind, prepare, repository } = createRepository();

		await repository.getResponseByIdForProject("response-1", "project-1");

		const query = prepare.mock.calls[0][0] as string;
		expect(query).toContain("id = ?");
		expect(query).toContain("project_id = ?");
		expect(query).not.toContain("user_id = ?");
		expect(bind).toHaveBeenCalledWith("response-1", "project-1", "dynamic_app_response");
	});
});
