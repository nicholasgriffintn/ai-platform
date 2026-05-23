import { describe, expect, it } from "vitest";

import { getModels } from "../index";

describe("getModels", () => {
	it("keeps OpenAI GPT-5.4 catalogue entries alongside reseller providers", () => {
		const models = getModels({
			shouldUseCache: false,
			excludeModalities: [
				"guardrails",
				"voice-activity-detection",
				"reranking",
				"embedding",
				"speech",
			],
		});

		expect(models["gpt-5.4"]?.provider).toBe("openai");
		expect(models["azure-openai/gpt-5.4"]?.provider).toBe("azure-openai");
		expect(models["github-copilot/gpt-5.4"]?.provider).toBe("github-copilot");
		expect(models["openai/gpt-5.4"]?.provider).toBe("openrouter");
		expect(models["vercel/openai/gpt-5.4"]?.provider).toBe("vercel");
	});
});
