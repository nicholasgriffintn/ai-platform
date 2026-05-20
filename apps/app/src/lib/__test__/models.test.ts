import { describe, expect, it } from "vitest";

import type { ModelConfig } from "~/types";
import { getModelProvider, getModelsByMode } from "../models";

describe("getModelsByMode", () => {
	it("excludes embedding-only models from the selector", () => {
		const models: ModelConfig = {
			"kimi-k2": {
				id: "kimi-k2",
				name: "Kimi K2",
				matchingModel: "moonshotai/Kimi-K2-Instruct",
				provider: "deepinfra",
				modalities: { input: ["text"], output: ["text"] },
			},
			"text-embedding-3-large": {
				id: "text-embedding-3-large",
				name: "text-embedding-3-large",
				matchingModel: "text-embedding-3-large",
				provider: "openai",
				modalities: { input: ["text"], output: ["embedding"] },
			},
			"hidden-model": {
				id: "hidden-model",
				name: "Hidden Model",
				matchingModel: "hidden-model",
				provider: "openai",
				modalities: { input: ["text"], output: ["text"] },
				hiddenFromDefaultList: true,
			},
		};

		expect(Object.keys(getModelsByMode(models, "remote"))).toEqual(["kimi-k2"]);
	});
});

describe("getModelProvider", () => {
	it("returns the provider for a selected model id", () => {
		const models: ModelConfig = {
			"grok-3-gh": {
				id: "grok-3-gh",
				name: "Grok 3",
				matchingModel: "xai/grok-3",
				provider: "github-models",
			},
		};

		expect(getModelProvider(models, "grok-3-gh")).toBe("github-models");
	});

	it("returns undefined when no model is selected", () => {
		expect(getModelProvider({}, null)).toBeUndefined();
	});
});
