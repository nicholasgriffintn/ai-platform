import { describe, expect, it } from "vitest";
import { CAPABILITY_DISCOVERY_TOOL_NAME } from "@ngriffin_uk/polychat-schemas";
import { listFunctionTools, resolveFunctionTool, toolRegistry } from "~/services/functions";

describe("functions tool registry", () => {
	it("registers every function in the tool registry", () => {
		const functionTools = listFunctionTools();
		const registeredTools = toolRegistry.list("functions");
		expect(registeredTools).toHaveLength(functionTools.length);

		const registeredNames = new Set(registeredTools.map((tool) => tool.name));
		for (const fn of functionTools) {
			expect(registeredNames.has(fn.name)).toBe(true);
		}
	});

	it("resolves tool definitions for every available function", () => {
		for (const fn of listFunctionTools()) {
			const definition = resolveFunctionTool(fn.name);
			expect(definition.name).toBe(fn.name);
			expect(typeof definition.execute).toBe("function");
			expect(typeof definition.inputSchema.safeParse).toBe("function");
		}
	});

	it("keeps Composio operations out of the global function registry", () => {
		const names = listFunctionTools().map((tool) => tool.name);

		expect(names).toContain("use_recipe_connector");
		expect(names).not.toContain("posthog_list_organization_projects");
		expect(names).not.toContain("polymarket_us_create_order");
		expect(names.some((name) => name.startsWith("zeplin_"))).toBe(false);
	});

	it("registers capability discovery as a default read-only tool", () => {
		const discovery = resolveFunctionTool(CAPABILITY_DISCOVERY_TOOL_NAME);
		const names = listFunctionTools().map((tool) => tool.name);

		expect(discovery.isDefault).toBe(true);
		expect(discovery.permissions).toEqual(["read"]);
		expect(names).not.toContain("search_functions");
		expect(names).not.toContain("get_function_schema");
	});
});
