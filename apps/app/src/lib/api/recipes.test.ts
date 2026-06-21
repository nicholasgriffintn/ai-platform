import { afterEach, describe, expect, it, vi } from "vitest";

import { installAssistantRecipe, invokeAssistantRecipe } from "./recipes";

describe("recipes api", () => {
	afterEach(() => {
		vi.restoreAllMocks();
		vi.unstubAllGlobals();
	});

	it("invokes installed recipes through the invoke endpoint", async () => {
		const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
			Response.json({
				recipeId: "daily-weather",
				installationId: "installation-1",
				channel: "web",
				status: "ready",
				conversationStarter: "Run the daily weather recipe.",
				messageUrl: "/?query=Run+the+daily+weather+recipe.",
				missingConnections: [],
				enabledTools: ["get_weather"],
				allowedConnectorProviders: [],
				configuration: { location: "London" },
			}),
		);
		vi.stubGlobal("fetch", fetchMock);

		const result = await invokeAssistantRecipe("daily-weather", "today");

		expect(fetchMock).toHaveBeenCalledTimes(1);
		const [url, init] = fetchMock.mock.calls[0];
		expect(String(url)).toContain("/apps/recipes/daily-weather/invoke");
		expect(init).toMatchObject({ method: "POST" });
		expect(JSON.parse(String(init?.body))).toEqual({ channel: "web", input: "today" });
		expect(result.status).toBe("ready");
		expect(result.configuration).toEqual({ location: "London" });
	});

	it("sends recipe triggers when installing a scheduled recipe", async () => {
		const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
			Response.json({
				recipe: {
					id: "daily-weather",
					title: "Daily Weather",
					summary: "Forecast",
					description: "Forecast",
					kind: "automate",
					category: "Productivity",
					featured: false,
					estimatedSetupMinutes: 2,
					integrations: [],
					triggers: [],
					actions: [],
					setupPrompt: "Set up weather",
					enabledTools: ["get_weather"],
					configurationFields: [],
				},
				conversationStarter: "Run the daily weather recipe.",
				messageUrl: "/?query=Run+the+daily+weather+recipe.",
				checklist: [],
				connections: [],
				readyToRun: true,
				enabledTools: ["get_weather"],
			}),
		);
		vi.stubGlobal("fetch", fetchMock);

		await installAssistantRecipe(
			"daily-weather",
			[
				{
					type: "schedule",
					enabled: true,
					cronExpression: "5 9 * * *",
					notificationChannel: "sms",
					notificationTarget: "+15551234567",
				},
			],
			{ location: "London" },
		);

		expect(fetchMock).toHaveBeenCalledTimes(1);
		const [url, init] = fetchMock.mock.calls[0];
		expect(String(url)).toContain("/apps/recipes/daily-weather/install");
		expect(init).toMatchObject({ method: "POST" });
		expect(JSON.parse(String(init?.body))).toEqual({
			channel: "web",
			triggers: [
				{
					type: "schedule",
					enabled: true,
					cronExpression: "5 9 * * *",
					notificationChannel: "sms",
					notificationTarget: "+15551234567",
				},
			],
			configuration: { location: "London" },
		});
	});

	it("throws the API recipe install error message", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () =>
				Response.json(
					{
						error: {
							message: "Morning Briefing needs a location before it can run.",
							code: "recipe_configuration_required",
						},
					},
					{ status: 400 },
				),
			),
		);

		await expect(installAssistantRecipe("morning-briefing")).rejects.toThrow(
			"Morning Briefing needs a location before it can run.",
		);
	});
});
