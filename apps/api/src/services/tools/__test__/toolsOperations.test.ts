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
	],
}));

import { getAvailableTools } from "../toolsOperations";

describe("getAvailableTools", () => {
	it("includes BYOK tools for signed-in users", () => {
		const tools = getAvailableTools(false, true);

		expect(tools.map((tool) => tool.id)).toEqual(["web_search", "research"]);
	});

	it("hides BYOK tools from anonymous users", () => {
		const tools = getAvailableTools(false, false);

		expect(tools.map((tool) => tool.id)).toEqual(["web_search"]);
	});

	it("keeps platform premium tools hidden from non-Pro users", () => {
		const tools = getAvailableTools(false, true);

		expect(tools.map((tool) => tool.id)).not.toContain("run_code_review");
	});
});
