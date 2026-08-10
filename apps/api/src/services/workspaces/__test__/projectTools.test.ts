import { describe, expect, it } from "vitest";

import { validateProjectToolConfiguration } from "../projectTools";

describe("project tool configuration", () => {
	it("rejects incomplete configuration for tools marked as requiring it", () => {
		expect(() => validateProjectToolConfiguration("file_search", {})).toThrow(
			"File search configuration is incomplete",
		);
		expect(() =>
			validateProjectToolConfiguration("mcp", {
				servers: [{ label: "Internal", url: "http://localhost:8787/mcp" }],
			}),
		).toThrow("MCP configuration is incomplete");
	});

	it("does not accept arbitrary tool identifiers or configuration", () => {
		expect(() => validateProjectToolConfiguration("unknown", {})).toThrow("Unknown project tool");
		expect(validateProjectToolConfiguration("web_fetch", { unexpected: true })).toEqual({});
	});
});
