import { describe, expect, it } from "vitest";

import { parseProjectToolConfiguration } from "../project-tool-configuration";

describe("project tool configuration", () => {
	it("validates API-selected file search and MCP configuration contracts", () => {
		expect(
			parseProjectToolConfiguration(
				{
					id: "file_search",
					capability: "supportsFileSearch",
					category: "Knowledge",
					command: "file search",
					configurationKind: "file_search",
					description: "Search files",
					label: "File search",
					requiresConfiguration: true,
				},
				{ vectorStoreIds: [] },
			),
		).toBeNull();

		expect(
			parseProjectToolConfiguration(
				{
					id: "mcp",
					capability: "supportsMcp",
					category: "Integrations",
					command: "mcp",
					configurationKind: "mcp",
					description: "Use MCP servers",
					label: "MCP",
					requiresConfiguration: true,
				},
				{ servers: [{ label: "Docs", url: "https://mcp.example.com" }] },
			),
		).toEqual({ servers: [{ label: "Docs", url: "https://mcp.example.com" }] });
	});
});
