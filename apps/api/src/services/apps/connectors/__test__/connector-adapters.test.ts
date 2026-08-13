import { describe, expect, it } from "vitest";
import { recipeConnectorProviderSchema } from "@ngriffin_uk/polychat-schemas";

import { connectorProviders } from "~/lib/providers/capabilities/connectors";
import { configuredComposioToolkits } from "~/lib/providers/capabilities/connectors/composio/configured-toolkit-manifest";
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
			if (adapter.provider.auth.authType === "composio") {
				expect(adapter.executeOperation).toBeUndefined();
				expect(adapter.approval).toMatchObject({
					mode: "stored-action",
					resolveAuthority: expect.any(Function),
				});
				expect(adapter.provider.auth.toolkitVersion).toMatch(/^\d{8}_\d{2}$/);
				expect(adapter.provider.operations.every((operation) => operation.id)).toBe(true);
				continue;
			}

			if (adapter.provider.operations.length > 0) {
				expect(adapter.executeOperation, adapter.provider.id).toBeTypeOf("function");
			}
			expect(adapter.approval).toBeUndefined();
		}
	});

	it("pins every Composio operation to an explicit toolkit version and exact tool slug", () => {
		for (const adapter of getRecipeConnectorAdapters()) {
			if (adapter.provider.auth.authType !== "composio") continue;

			expect(adapter.provider.auth.toolkitSlug, adapter.provider.id).not.toBe("");
			expect(adapter.provider.auth.toolkitVersion, adapter.provider.id).toMatch(/^\d{8}_\d{2}$/);
			for (const operation of adapter.provider.operations) {
				expect(operation.id, `${adapter.provider.id}:${operation.id}`).toMatch(/^[A-Z0-9_]+$/);
			}
		}
	});

	it("publishes the complete non-deprecated catalogue for every configured toolkit", () => {
		expect(Object.keys(configuredComposioToolkits)).toHaveLength(130);
		expect(
			Object.values(configuredComposioToolkits).reduce(
				(total, toolkit) => total + toolkit.operations.length,
				0,
			),
		).toBe(12_505);
		expect(configuredComposioToolkits.github.operations).toHaveLength(871);
		expect(configuredComposioToolkits.cloudflare.operations).toHaveLength(20);
		expect(configuredComposioToolkits.gmail.operations).toHaveLength(61);
		expect(configuredComposioToolkits.whatsapp).toMatchObject({
			providerId: "whatsapp",
			toolkitSlug: "whatsapp",
		});
		expect(configuredComposioToolkits.whatsapp.authConfigs).toHaveLength(2);
		expect(Object.keys(configuredComposioToolkits).every((id) => !id.includes("__"))).toBe(true);
	});

	it("retains write, destructive, and trading tools in the compact index", () => {
		const createOrder = configuredComposioToolkits.polymarket_us.operations.find(
			(operation) => operation.id === "POLYMARKET_US_CREATE_ORDER",
		);
		const deleteForm = configuredComposioToolkits.typeform.operations.find(
			(operation) => operation.id === "TYPEFORM_DELETE_FORM",
		);
		const sendBatch = configuredComposioToolkits.postmark.operations.find(
			(operation) => operation.id === "POSTMARK_SEND_BATCH_WITH_TEMPLATES",
		);

		expect(createOrder).toMatchObject({
			access: "write",
			authConfigIds: expect.any(Array),
		});
		expect(deleteForm).toMatchObject({ access: "write" });
		expect(sendBatch).toMatchObject({ access: "write" });
	});
});
