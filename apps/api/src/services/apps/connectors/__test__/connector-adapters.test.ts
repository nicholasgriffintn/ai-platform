import { describe, expect, it } from "vitest";
import { recipeConnectorProviderSchema } from "@assistant/schemas";

import { connectorProviders } from "~/lib/providers/capabilities/connectors";
import {
	getRecipeConnectorAdapters,
	getRecipeConnectorProviderConfigs,
} from "../connector-adapters";

describe("recipe connector adapters", () => {
	it("publishes provider configs from the registered adapter list", () => {
		const adapters = getRecipeConnectorAdapters();

		expect(getRecipeConnectorProviderConfigs()).toEqual(
			adapters.map((adapter) => adapter.provider),
		);
		expect(connectorProviders).toEqual(getRecipeConnectorProviderConfigs());
		expect(new Set(adapters.map((adapter) => adapter.provider.id)).size).toBe(adapters.length);
		expect(adapters.map((adapter) => adapter.provider.id).sort()).toEqual(
			Array.from(recipeConnectorProviderSchema.options).sort(),
		);
	});

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
