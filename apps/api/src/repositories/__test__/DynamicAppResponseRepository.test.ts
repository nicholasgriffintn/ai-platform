import { describe, expect, it, vi } from "vitest";

import { DynamicAppResponseRepository } from "../DynamicAppResponseRepository";

function createRepository() {
	const all = vi.fn().mockResolvedValue({ results: [] });
	const first = vi.fn().mockResolvedValue(null);
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
});
