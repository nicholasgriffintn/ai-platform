import { describe, expect, it, vi } from "vitest";
import z from "zod/v4";
import { ToolRegistry } from "../ToolRegistry";

function createDefinition(name: string) {
	return {
		name,
		description: `${name} description`,
		inputSchema: z.object({}),
		type: "normal" as const,
		costPerCall: 0,
		permissions: ["read"],
		execute: vi.fn(async () => ({ status: "success", name })),
	};
}

describe("ToolRegistry", () => {
	it("registers and resolves a tool", () => {
		const registry = new ToolRegistry();
		registry.register("functions", {
			name: "web_search",
			create: () => createDefinition("web_search"),
		});

		const resolved = registry.resolve("functions", "web_search");
		expect(resolved.name).toBe("web_search");
	});

	it("throws on duplicate registration", () => {
		const registry = new ToolRegistry();
		registry.register("functions", {
			name: "web_search",
			create: () => createDefinition("web_search"),
		});

		expect(() =>
			registry.register("functions", {
				name: "web_search",
				create: () => createDefinition("web_search"),
			}),
		).toThrow('Tool "web_search" already registered for category "functions"');
	});

	it("listDefinitions returns all unique tool definitions", () => {
		const registry = new ToolRegistry();
		registry.register("functions", {
			name: "web_search",
			aliases: ["search_web"],
			create: () => createDefinition("web_search"),
		});
		registry.register("functions", {
			name: "get_weather",
			create: () => createDefinition("get_weather"),
		});

		const definitions = registry.listDefinitions("functions");
		expect(definitions.map((tool) => tool.name).sort()).toEqual([
			"get_weather",
			"web_search",
		]);
	});

	it("resolves aliases to the registered tool", () => {
		const registry = new ToolRegistry();
		const create = vi.fn(() => createDefinition("web_search"));
		registry.register("functions", {
			name: "web_search",
			aliases: ["search_web"],
			create,
		});

		const byAlias = registry.resolve("functions", "search_web");
		const byName = registry.resolve("functions", "web_search");

		expect(byAlias.name).toBe("web_search");
		expect(byName).toBe(byAlias);
		expect(create).toHaveBeenCalledTimes(1);
	});
});
