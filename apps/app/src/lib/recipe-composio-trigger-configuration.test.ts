import { describe, expect, it } from "vitest";

import {
	buildRecipeTriggerConfiguration,
	getRecipeTriggerConfigurationFields,
} from "./recipe-composio-trigger-configuration";

describe("recipe event trigger configuration", () => {
	it("exposes only supported primitive fields and reports unsupported required fields", () => {
		const result = getRecipeTriggerConfigurationFields({
			type: "object",
			required: ["branch", "filters"],
			properties: {
				branch: { type: "string", title: "Branch", description: "Branch to watch" },
				priority: { type: "integer", title: "Minimum priority" },
				includeDrafts: { type: "boolean", title: "Include drafts", default: false },
				filters: { type: "array", title: "Advanced filters" },
			},
		});

		expect(result.fields).toEqual([
			expect.objectContaining({ key: "branch", label: "Branch", type: "text", required: true }),
			expect.objectContaining({ key: "priority", type: "number", required: false }),
			expect.objectContaining({ key: "includeDrafts", type: "boolean", defaultValue: false }),
		]);
		expect(result.unsupportedRequiredLabels).toEqual(["Advanced filters"]);
	});

	it("validates required values and preserves primitive configuration types", () => {
		const fields = getRecipeTriggerConfigurationFields({
			type: "object",
			required: ["branch", "limit"],
			properties: {
				branch: { type: "string", title: "Branch" },
				limit: { type: "number", title: "Limit" },
				enabled: { type: "boolean", title: "Enabled" },
			},
		}).fields;

		expect(
			buildRecipeTriggerConfiguration(fields, { branch: "", limit: "many", enabled: true }),
		).toEqual({ configuration: {}, error: "Complete Branch and enter a valid Limit." });
		expect(
			buildRecipeTriggerConfiguration(fields, { branch: "main", limit: "10", enabled: true }),
		).toEqual({ configuration: { branch: "main", limit: 10, enabled: true } });
	});
});
