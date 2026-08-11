import { describe, expect, it, vi } from "vitest";

vi.mock("~/services/functions", () => ({
	listFunctionTools: () => [
		{
			name: "web_search",
			description: "Search",
			type: "normal",
			isDefault: true,
		},
		{
			name: "research",
			description: "Research",
			type: "byok",
			isDefault: false,
		},
		{
			name: "run_code_review",
			description: "Sandbox review",
			type: "premium",
			isDefault: false,
		},
		{
			name: "connector_slack_search",
			description: "Search Slack",
			type: "normal",
			isDefault: false,
		},
		{
			name: "unknown_tool",
			description: "A future tool",
			type: "normal",
			isDefault: false,
		},
	],
}));

import { getAvailableTools } from "../toolsOperations";

describe("getAvailableTools", () => {
	it("includes BYOK tools for signed-in users", () => {
		const tools = getAvailableTools(false, true);

		expect(tools.map((tool) => tool.id)).toEqual([
			"web_search",
			"research",
			"connector_slack_search",
			"unknown_tool",
		]);
	});

	it("hides BYOK tools from anonymous users", () => {
		const tools = getAvailableTools(false, false);

		expect(tools.map((tool) => tool.id)).toEqual([
			"web_search",
			"connector_slack_search",
			"unknown_tool",
		]);
	});

	it("keeps platform premium tools hidden from non-Pro users", () => {
		const tools = getAvailableTools(false, true);

		expect(tools.map((tool) => tool.id)).not.toContain("run_code_review");
	});

	it("does not mark tools as default for non-Pro users", () => {
		const tools = getAvailableTools(false, true);

		expect(tools.find((tool) => tool.id === "web_search")?.isDefault).toBe(false);
	});

	it("marks default tools for Pro users", () => {
		const tools = getAvailableTools(true, true);

		expect(tools.find((tool) => tool.id === "web_search")?.isDefault).toBe(true);
	});

	it("returns stable categories for known, connector, and future tools", () => {
		const tools = getAvailableTools(false, true);

		expect(tools.find((tool) => tool.id === "web_search")?.category).toBe("Research");
		expect(tools.find((tool) => tool.id === "connector_slack_search")?.category).toBe(
			"Productivity",
		);
		expect(tools.find((tool) => tool.id === "unknown_tool")?.category).toBe("Other");
	});

	it("publishes human-readable names without changing callable identifiers", () => {
		const tools = getAvailableTools(false, true);

		expect(tools.find((tool) => tool.id === "web_search")?.name).toBe("Web Search");
	});
});
