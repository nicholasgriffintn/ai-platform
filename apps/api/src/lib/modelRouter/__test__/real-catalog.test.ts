import { beforeEach, describe, expect, it, vi } from "vitest";

import { filterModelsByRouterMode } from "@assistant/schemas";
import { ModelRouter } from "../index";
import { getIncludedInRouterModelsForUser } from "~/lib/providers/models";
import type { IEnv, IUser } from "~/types";

const mockPromptAnalyzer = vi.hoisted(() => ({
	analyzePrompt: vi.fn(),
}));

const mockRepositories = vi.hoisted(() => ({
	getUserProviderSettings: vi.fn(),
}));

vi.mock("~/lib/modelRouter/promptAnalyser", () => ({
	PromptAnalyzer: mockPromptAnalyzer,
}));

vi.mock("~/lib/monitoring", () => ({
	trackModelRoutingMetrics: vi.fn(async (fn: () => Promise<unknown>) => fn()),
}));

vi.mock("~/repositories", () => ({
	RepositoryManager: class {
		userSettings = {
			getUserProviderSettings: mockRepositories.getUserProviderSettings,
		};
	},
}));

vi.mock("~/utils/logger", () => ({
	getLogger: () => ({
		warn: vi.fn(),
		error: vi.fn(),
		info: vi.fn(),
		debug: vi.fn(),
	}),
}));

const env: IEnv = Object.assign(Object.create(null), {
	ANALYTICS: false,
	ALWAYS_ENABLED_PROVIDERS: "workers-ai,mistral,deepseek,google-ai-studio,cohere",
});

const defaultPromptRequirements = {
	expectedComplexity: 3,
	requiredStrengths: [],
	criticalStrengths: [],
	estimatedInputTokens: 1000,
	estimatedOutputTokens: 500,
	needsFunctions: false,
	hasImages: false,
	hasDocuments: false,
	benefitsFromMultipleModels: false,
	modelComparisonReason: "",
};

const user: IUser = {
	id: 1,
	name: "Test User",
	avatar_url: null,
	email: "user@example.com",
	github_username: null,
	company: null,
	site: null,
	location: null,
	bio: null,
	twitter_username: null,
	role: "user",
	created_at: "2026-06-30T00:00:00.000Z",
	updated_at: "2026-06-30T00:00:00.000Z",
	setup_at: null,
	terms_accepted_at: null,
	plan_id: "pro",
};

describe("ModelRouter real catalogue routing", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockRepositories.getUserProviderSettings.mockResolvedValue([]);
		mockPromptAnalyzer.analyzePrompt.mockResolvedValue(defaultPromptRequirements);
	});

	it("rejects pro routing instead of falling back outside the accessible mode pool", async () => {
		const accessibleModels = await getIncludedInRouterModelsForUser(env);
		const proModels = filterModelsByRouterMode(accessibleModels, "pro");

		expect(Object.keys(proModels).length).toBeGreaterThan(0);
		mockPromptAnalyzer.analyzePrompt.mockResolvedValueOnce({
			...defaultPromptRequirements,
			criticalStrengths: ["transcription"],
		});

		await expect(
			ModelRouter.selectModel(env, "hi", [], undefined, undefined, "completion-123", "pro"),
		).rejects.toThrow("No suitable models found for pro automatic mode.");
	});

	it("selects from the pro pool when authenticated access exposes pro candidates", async () => {
		const accessibleModels = await getIncludedInRouterModelsForUser(env, user.id);
		const proModels = filterModelsByRouterMode(accessibleModels, "pro");

		const selectedModel = await ModelRouter.selectModel(
			env,
			"hi",
			[],
			undefined,
			user,
			"completion-123",
			"pro",
		);

		expect(Object.keys(proModels).length).toBeGreaterThan(0);
		expect(Object.keys(proModels)).toContain(selectedModel);
		expect(selectedModel).not.toBe("deepseek-v4-flash");
	});

	it("does not include flash-grade models in the real pro accessible catalogue", async () => {
		const accessibleModels = await getIncludedInRouterModelsForUser(env);
		const proModels = filterModelsByRouterMode(accessibleModels, "pro");

		expect(Object.keys(proModels)).not.toContain("deepseek-v4-flash");
	});

	it("keeps always-enabled pro candidates when user provider settings fail", async () => {
		mockRepositories.getUserProviderSettings.mockRejectedValueOnce(
			new Error("provider settings unavailable"),
		);

		const accessibleModels = await getIncludedInRouterModelsForUser(env, user.id);
		const proModels = filterModelsByRouterMode(accessibleModels, "pro");

		expect(Object.keys(proModels).length).toBeGreaterThan(0);
		expect(Object.keys(proModels)).not.toContain("deepseek-v4-flash");
	});
});
