import { describe, expect, it } from "vitest";
import type { AssistantActionItem, AssistantActionItemKind } from "@assistant/schemas";

import {
	filterProjectCapabilities,
	getProjectCapabilityCategories,
	groupProjectCapabilities,
} from "~/lib/project-capability-catalog";

function capabilityItem({
	category,
	id,
	kind,
	label,
}: {
	category: string;
	id: string;
	kind: AssistantActionItemKind;
	label: string;
}): AssistantActionItem {
	return {
		id,
		kind,
		label,
		description: `${label} description`,
		searchText: [label, category],
		launch: { kind: "navigation", path: "/" },
		metadata: { category },
		capability: {
			id,
			kind: kind === "tool" ? "tool" : kind === "app" ? "dynamic_app" : "recipe",
			name: label,
			description: `${label} description`,
			availability: "available",
			launch: { method: "navigation" },
			executionMode: "function",
			authRequirement: "none",
			requiredModelCapabilities: [],
			requiredConnectors: [],
			savedState: { supported: false },
			tags: [category],
		},
	};
}

const items = [
	capabilityItem({ category: "Research", id: "app-1", kind: "app", label: "Article finder" }),
	capabilityItem({
		category: "Productivity",
		id: "recipe-1",
		kind: "installed_recipe",
		label: "Morning brief",
	}),
	capabilityItem({ category: "Development", id: "tool-1", kind: "tool", label: "Code execution" }),
];

describe("project capability catalogue", () => {
	it("filters by thing, category, and search text", () => {
		expect(
			filterProjectCapabilities(items, {
				category: "Productivity",
				kind: "recipe",
				query: "brief",
			}).map((item) => item.id),
		).toEqual(["recipe-1"]);
	});

	it("organises visible capabilities by thing and category", () => {
		expect(getProjectCapabilityCategories(items, "all")).toEqual([
			"Development",
			"Productivity",
			"Research",
		]);
		expect(groupProjectCapabilities(items).map((group) => group.label)).toEqual([
			"Apps",
			"Recipes",
			"Tools",
		]);
		expect(groupProjectCapabilities(items)[0]?.categories[0]?.category).toBe("Research");
	});
});
