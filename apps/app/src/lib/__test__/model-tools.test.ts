import { describe, expect, it } from "vitest";
import { filterUnavailableModelToolSelections, getModelToolOptions } from "~/lib/model-tools";

describe("model tool options", () => {
	it("explains available and incompatible tools for the selected model", () => {
		const options = getModelToolOptions({
			supportsToolCalls: true,
			supportsFileSearch: true,
			supportsMcp: true,
			supportsWebFetch: true,
			supportsHostedShell: false,
		});

		expect(options.find((tool) => tool.id === "web_fetch")).toMatchObject({
			available: true,
			availabilityReason: "Available for the selected model.",
			requiredModelCapabilities: ["supportsWebFetch"],
		});
		expect(options.find((tool) => tool.id === "hosted_shell")).toMatchObject({
			available: false,
			availabilityReason: "The selected model does not support hosted shell.",
			requiredModelCapabilities: ["supportsHostedShell"],
		});
		expect(options.find((tool) => tool.id === "mcp")).toMatchObject({
			available: false,
			availabilityReason: "Configure MCP servers before enabling MCP.",
			requiredModelCapabilities: ["supportsMcp"],
		});
		expect(options.find((tool) => tool.id === "file_search")).toMatchObject({
			available: false,
			availabilityReason: "Configure vector stores before enabling file search.",
			requiredModelCapabilities: ["supportsFileSearch"],
		});
	});

	it("filters stale hosted model tool selections while preserving backend tools", () => {
		expect(
			filterUnavailableModelToolSelections(["web_search", "web_fetch", "file_search"], {
				supportsToolCalls: true,
				supportsWebFetch: true,
				supportsFileSearch: true,
			}),
		).toEqual(["web_search", "web_fetch"]);

		expect(filterUnavailableModelToolSelections(["web_search", "web_fetch"], undefined)).toEqual([
			"web_search",
			"web_fetch",
		]);
	});
});
