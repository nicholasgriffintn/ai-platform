import type { Tool } from "@assistant/schemas";
import { describe, expect, it } from "vitest";

import { filterTools, getAvailableToolCategories } from "../tool-filters";

const tools: Tool[] = [
	{
		id: "web_search",
		name: "Web search",
		description: "Find current information",
		category: "Research",
	},
	{
		id: "create_image",
		name: "Create image",
		description: "Generate an illustration",
		category: "Creative",
	},
	{
		id: "create_note",
		name: "Create note",
		description: "Save information for later",
		category: "Productivity",
	},
];

describe("tool filters", () => {
	it("returns only categories represented by the available tools in catalogue order", () => {
		expect(getAvailableToolCategories(tools)).toEqual(["Research", "Creative", "Productivity"]);
	});

	it("combines category and case-insensitive text filters", () => {
		expect(
			filterTools(tools, {
				category: "Creative",
				query: "ILLUSTRATION",
				selectedToolIds: [],
			}).map((tool) => tool.id),
		).toEqual(["create_image"]);
	});

	it("filters to selected tools", () => {
		expect(
			filterTools(tools, {
				category: "selected",
				query: "",
				selectedToolIds: ["create_note"],
			}).map((tool) => tool.id),
		).toEqual(["create_note"]);
	});
});
