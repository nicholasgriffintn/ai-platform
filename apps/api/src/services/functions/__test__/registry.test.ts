import { describe, expect, it } from "vitest";
import { listFunctionTools, resolveFunctionTool, toolRegistry } from "~/services/functions";
import { listConnectorOperationMcpDescriptors } from "../recipes/connector_operation_tools";

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

	it("generates executable connector operation tools from the connector registry", () => {
		const posthogQuery = resolveFunctionTool("connector_posthog_query");
		const todoistCreateTask = resolveFunctionTool("connector_todoist_create_task");

		expect(posthogQuery).toMatchObject({
			name: "connector_posthog_query",
			type: "premium",
			permissions: ["network", "read"],
		});
		expect(todoistCreateTask).toMatchObject({
			name: "connector_todoist_create_task",
			type: "premium",
			permissions: ["network", "write"],
		});
		expect(
			posthogQuery.inputSchema.safeParse({
				params: { query: "select * from events limit 5" },
			}).success,
		).toBe(true);
		expect(listFunctionTools().some((tool) => tool.name === "connector_posthog_query")).toBe(true);
	});

	it("generates MCP-compatible connector operation descriptors from the connector registry", () => {
		expect(
			listConnectorOperationMcpDescriptors().find(
				(descriptor) => descriptor.name === "connector_posthog_query",
			),
		).toMatchObject({
			name: "connector_posthog_query",
			description: expect.stringContaining("PostHog"),
			input_schema: {
				type: "object",
				properties: {
					params: {
						type: "object",
					},
				},
			},
			annotations: {
				access: "read",
				provider: "posthog",
				requiresApproval: false,
			},
		});
	});
});
