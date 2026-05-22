import { describe, expect, it } from "vitest";

import type { ChatSettings, ModelConfigItem } from "~/types";
import { applyModelResponseDefaults } from "../chat-settings";

describe("chat settings model defaults", () => {
	it("updates reasoning and verbosity defaults for the selected model", () => {
		const settings: ChatSettings = {
			temperature: 0.4,
			localOnly: false,
			reasoning: { effort: "simulated-thinking" },
			verbosity: "low",
		};
		const model: ModelConfigItem = {
			id: "reasoning-model",
			matchingModel: "reasoning-model",
			provider: "test",
			reasoningConfig: {
				supportedEffortLevels: ["low", "medium", "high"],
				defaultEffort: "high",
			},
			verbosityConfig: {
				supportedVerbosityLevels: ["low", "high"],
				defaultVerbosity: "high",
			},
		};

		expect(applyModelResponseDefaults(settings, model)).toEqual({
			temperature: 0.4,
			localOnly: false,
			reasoning: { effort: "high" },
			verbosity: "high",
		});
	});

	it("uses fallback app defaults when the model has no config", () => {
		const settings: ChatSettings = {
			reasoning: { effort: "high" },
			verbosity: "caveman",
		};

		expect(applyModelResponseDefaults(settings)).toEqual({
			reasoning: { effort: "none" },
			verbosity: "medium",
		});
	});
});
