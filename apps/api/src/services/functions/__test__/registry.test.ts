import { describe, expect, it } from "vitest";
import {
	listFunctionTools,
	resolveFunctionTool,
	toolRegistry,
} from "~/services/functions";

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
});
