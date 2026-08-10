import { describe, expect, it } from "vitest";

import { getProjectExperienceCatalog, PROJECT_TOOL_DEFINITIONS } from "../config";
import { getDynamicAppCatalog } from "../index";

describe("dynamic app catalog", () => {
	it("includes featured frontend apps from the service catalog", async () => {
		await expect(getDynamicAppCatalog()).resolves.toContainEqual(
			expect.objectContaining({
				id: "featured-strudel",
				featured: true,
				kind: "frontend",
				href: "/apps/strudel",
				capability: expect.objectContaining({
					id: "featured-strudel",
					kind: "frontend_app",
					name: "Strudel Music Patterns",
					description: expect.any(String),
					availability: "available",
					launch: {
						method: "navigation",
						href: "/apps/strudel",
					},
					executionMode: "navigation",
					authRequirement: "none",
					savedState: {
						supported: false,
					},
					tags: expect.any(Array),
				}),
			}),
		);
	});

	it("publishes project experience configuration from the same catalogue", () => {
		expect(getProjectExperienceCatalog()).toContainEqual(
			expect.objectContaining({
				id: "strudel",
				runtime: "strudel",
				name: "Strudel Music Patterns",
				requirement: {
					kind: "capability",
					capabilityKind: "app",
					capabilityId: "featured-strudel",
				},
			}),
		);
		expect(getProjectExperienceCatalog()).not.toContainEqual(
			expect.objectContaining({ runtime: "recipes" }),
		);
	});

	it("declares the configuration runtime for tools that cannot run unconfigured", () => {
		expect(PROJECT_TOOL_DEFINITIONS.find((tool) => tool.id === "file_search")).toMatchObject({
			configurationKind: "file_search",
			requiresConfiguration: true,
		});
		expect(PROJECT_TOOL_DEFINITIONS.find((tool) => tool.id === "mcp")).toMatchObject({
			configurationKind: "mcp",
			requiresConfiguration: true,
		});
	});
});
