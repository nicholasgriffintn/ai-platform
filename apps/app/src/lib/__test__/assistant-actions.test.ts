import { describe, expect, it } from "vitest";
import {
	assistantActionCatalogSchema,
	assistantActionResultSchema,
	assistantActionSelectionSchema,
	buildAssistantActionCatalog,
	formatAssistantActionMention,
	mergeAssistantActionToolIds,
	normaliseAssistantActionToolIds,
} from "@assistant/schemas";

describe("assistant action catalogue", () => {
	it("merges verbs and action items from recipes, apps, connectors, agents, and tools", () => {
		const catalog = buildAssistantActionCatalog({
			agents: [
				{
					id: "agent-1",
					name: "Reviewer",
					description: "Reviews risky changes",
					model: "model-1",
				},
			],
			apps: [
				{
					id: "articles",
					name: "Article Research",
					description: "Analyse articles",
					category: "Research",
					kind: "dynamic",
					type: "normal",
					href: "/apps/articles",
				},
			],
			connectors: [
				{
					id: "posthog",
					name: "PostHog",
					description: "Query product analytics",
					authType: "api_key",
					status: "connected",
					scopes: ["project:read"],
					operations: ["query"],
				},
			],
			modelTools: [
				{
					id: "web_fetch",
					label: "Web fetch",
					command: "web fetch",
					description: "Fetch URLs",
				},
			],
			recipes: [
				{
					id: "morning-briefing",
					title: "Morning Briefing",
					summary: "Summarise your day",
					description: "Uses mail and calendar",
					kind: "automate",
					category: "Productivity",
					featured: true,
					estimatedSetupMinutes: 5,
					integrations: [],
					triggers: [{ type: "message", label: "Ask", description: "Ask for it" }],
					actions: ["Summarise priorities"],
					setupPrompt: "Set up the Morning Briefing recipe.",
					enabledTools: ["use_recipe_connector"],
					configurationFields: [],
				},
			],
			installations: [
				{
					id: "installation-1",
					recipeId: "morning-briefing",
					userId: 42,
					status: "active",
					triggers: [{ type: "manual", enabled: true }],
					configuration: {},
					createdAt: "2026-01-01T00:00:00.000Z",
					updatedAt: "2026-01-01T00:00:00.000Z",
				},
			],
		});

		expect(catalog.verbs.map((verb) => verb.command)).toEqual([
			"run",
			"setup",
			"connect",
			"open",
			"schedule",
			"ask",
			"use",
		]);
		expect(catalog.items.map((item) => `${item.kind}:${item.label}`)).toEqual([
			"installed_recipe:Morning Briefing",
			"app:Article Research",
			"agent:Reviewer",
			"connector:PostHog",
			"tool:Web fetch",
		]);
		expect(catalog.items[0]).toMatchObject({
			id: "installed_recipe:installation-1",
			metadata: {
				recipeId: "morning-briefing",
				installationId: "installation-1",
			},
		});
		expect(catalog.items[1]).toMatchObject({
			metadata: {
				appId: "articles",
				appKind: "dynamic",
				href: "/apps/articles",
			},
		});
		expect(catalog.items[2]).toMatchObject({
			metadata: {
				agentId: "agent-1",
			},
		});
		expect(catalog.items[3]).toMatchObject({
			metadata: {
				authType: "api_key",
				provider: "posthog",
			},
		});
		expect(catalog.items[4]).toMatchObject({
			metadata: {
				toolId: "web_fetch",
			},
		});
		expect(assistantActionCatalogSchema.safeParse(catalog).success).toBe(true);
		expect(
			assistantActionSelectionSchema.safeParse({
				verb: "run",
				item: {
					id: catalog.items[0]?.id,
					kind: catalog.items[0]?.kind,
					label: catalog.items[0]?.label,
					metadata: catalog.items[0]?.metadata,
				},
				tokenPosition: 4,
			}).success,
		).toBe(true);
	});

	it("keeps uninstalled recipes discoverable after installed recipes", () => {
		const catalog = buildAssistantActionCatalog({
			recipes: [
				{
					id: "daily-weather",
					title: "Daily Weather",
					summary: "Weather report",
					description: "Summarise weather",
					kind: "automate",
					category: "Home",
					featured: true,
					estimatedSetupMinutes: 1,
					integrations: [],
					triggers: [{ type: "message", label: "Ask", description: "Ask for it" }],
					actions: ["Summarise weather"],
					setupPrompt: "Set up the Daily Weather recipe.",
					enabledTools: [],
					configurationFields: [],
				},
			],
			installations: [],
		});

		expect(catalog.items).toMatchObject([
			{
				id: "recipe:daily-weather",
				kind: "recipe",
				label: "Daily Weather",
				status: "available",
			},
		]);
	});

	it("formats non-agent action items as visible mentions for unchanged chat execution", () => {
		expect(formatAssistantActionMention({ label: "PostHog" })).toBe("@PostHog");
	});

	it("validates assistant action results through the shared schema", () => {
		expect(
			assistantActionResultSchema.safeParse({
				kind: "conversation",
				input: "Run the Morning Briefing recipe.",
				selectedTools: ["use_recipe_connector"],
				requestOptions: {
					recipe: {
						id: "morning-briefing",
						channel: "web",
						allowedConnectorProviders: [],
						allowedConnectorOperations: {},
					},
				},
				url: "/?query=Run+the+Morning+Briefing+recipe.",
			}).success,
		).toBe(true);
		expect(
			assistantActionResultSchema.safeParse({
				kind: "submit",
				input: "use a bad tool",
				selectedTools: ["bad tool id"],
			}).success,
		).toBe(false);
	});

	it("normalises and merges assistant action tool ids through the shared schema helpers", () => {
		expect(
			normaliseAssistantActionToolIds(" use_recipe_connector, web_fetch, bad tool, web_fetch "),
		).toEqual(["use_recipe_connector", "web_fetch"]);
		expect(mergeAssistantActionToolIds(["web_fetch"], "code_execution")).toEqual([
			"web_fetch",
			"code_execution",
		]);
		expect(mergeAssistantActionToolIds(["web_fetch"], "web_fetch")).toEqual(["web_fetch"]);
	});
});
