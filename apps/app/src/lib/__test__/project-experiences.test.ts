import { describe, expect, it } from "vitest";
import type {
	DynamicAppCatalogItem,
	ProjectCapability,
	ProjectExperienceDefinition,
} from "@assistant/schemas";

import {
	getEnabledProjectExperiences,
	getProjectCapabilityOpenPath,
	getProjectExperiencePath,
} from "../project-experiences";

const experiences: ProjectExperienceDefinition[] = [
	{
		id: "strudel-studio",
		runtime: "strudel",
		name: "Music Studio",
		description: "Create music",
		requirement: {
			kind: "capability",
			capabilityKind: "app",
			capabilityId: "catalogue-music-app",
		},
	},
	{
		id: "outputs",
		runtime: "responses",
		name: "Outputs",
		description: "Saved outputs",
		requirement: {
			kind: "capability_kind",
			capabilityKind: "app",
			appKind: "dynamic",
		},
	},
];

const apps: DynamicAppCatalogItem[] = [
	{
		id: "catalogue-music-app",
		name: "Music Studio",
		description: "Create music",
		kind: "frontend",
	},
	{
		id: "weather",
		name: "Weather",
		description: "Weather",
		kind: "dynamic",
	},
];

const projectCapability = (
	kind: ProjectCapability["kind"],
	capabilityId: string,
): ProjectCapability => ({
	id: `${kind}-${capabilityId}`,
	projectId: "project-1",
	kind,
	capabilityId,
	configuration: {},
	createdAt: "2026-01-01",
});

describe("project experiences", () => {
	it("uses API catalogue configuration to map rich capabilities into Work routes", () => {
		expect(
			getProjectCapabilityOpenPath(
				{
					id: "app:catalogue-music-app",
					kind: "app",
					label: "Music Studio",
					searchText: [],
					capability: {
						id: "catalogue-music-app",
						kind: "frontend_app",
						name: "Music Studio",
						availability: "available",
						launch: { method: "navigation" },
						executionMode: "navigation",
						authRequirement: "none",
						requiredModelCapabilities: [],
						requiredConnectors: [],
						savedState: { supported: false },
						tags: [],
					},
					launch: { kind: "navigation", path: "/legacy/music" },
					metadata: { appKind: "frontend" },
				},
				"workspace-1",
				"project-1",
				experiences,
			),
		).toBe("/work/workspace-1/projects/project-1/experiences/strudel-studio");
	});

	it("enables capability-family managers from API requirements", () => {
		const enabled = getEnabledProjectExperiences(
			[projectCapability("app", "weather"), projectCapability("recipe", "morning-briefing")],
			experiences,
			apps,
		);

		expect(enabled.map((experience) => experience.id)).toEqual(["outputs"]);
	});

	it("links recipes directly to their API-backed configuration workflow", () => {
		expect(
			getProjectCapabilityOpenPath(
				{
					id: "recipe:morning-briefing",
					kind: "recipe",
					label: "Morning Briefing",
					searchText: [],
					capability: {
						id: "morning-briefing",
						kind: "recipe",
						name: "Morning Briefing",
						availability: "available",
						launch: { method: "conversation" },
						executionMode: "workflow",
						authRequirement: "pro",
						requiredModelCapabilities: [],
						requiredConnectors: [],
						savedState: { supported: true },
						tags: [],
					},
					launch: {
						kind: "conversation",
						operation: "install_recipe",
						recipeId: "morning-briefing",
					},
					metadata: { recipeId: "morning-briefing" },
				},
				"workspace-1",
				"project-1",
				experiences,
			),
		).toBe("/work/workspace-1/projects/project-1/library?action=configure&recipe=morning-briefing");
	});

	it("keeps dynamic app execution on the project form route", () => {
		expect(
			getProjectCapabilityOpenPath(
				{
					id: "app:weather",
					kind: "app",
					label: "Weather",
					searchText: [],
					capability: {
						id: "weather",
						kind: "dynamic_app",
						name: "Weather",
						availability: "available",
						launch: { method: "form" },
						executionMode: "function",
						authRequirement: "none",
						requiredModelCapabilities: [],
						requiredConnectors: [],
						savedState: { supported: true },
						tags: [],
					},
					launch: { kind: "navigation", path: "/legacy/apps?app=weather" },
					metadata: { appKind: "dynamic" },
				},
				"workspace-1",
				"project-1",
				experiences,
			),
		).toBe("/work/workspace-1/projects/project-1/apps/weather");
	});

	it("does not depend on fixed frontend capability IDs", () => {
		const enabled = getEnabledProjectExperiences(
			[projectCapability("app", "catalogue-music-app")],
			experiences,
			apps,
		);

		expect(enabled.map((experience) => experience.id)).toEqual(["strudel-studio"]);
		expect(getProjectExperiencePath("workspace-1", "project-1", "strudel-studio", "new")).toBe(
			"/work/workspace-1/projects/project-1/experiences/strudel-studio/new",
		);
	});
});
