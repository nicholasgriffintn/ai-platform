import { describe, expect, it } from "vitest";

import { getRecipeConnectorAdapters } from "../connector-adapters";

describe("recipe connector adapters", () => {
	it("keeps executable provider capabilities paired with an executor", () => {
		const adapters = getRecipeConnectorAdapters();

		for (const adapter of adapters) {
			if (adapter.provider.auth.authType === "github_app") {
				expect(adapter.executeOperation).toBeUndefined();
				continue;
			}

			if (adapter.provider.operations.length > 0) {
				expect(adapter.executeOperation, adapter.provider.id).toBeTypeOf("function");
			}
		}
	});
});
