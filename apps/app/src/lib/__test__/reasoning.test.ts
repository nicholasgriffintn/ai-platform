import { describe, expect, it } from "vitest";

import type { ModelConfigItem } from "~/types";
import { formatReasoningLabel, getDefaultReasoningEffort, getReasoningOptions } from "../reasoning";

describe("reasoning options", () => {
	it("uses none and simulated thinking when the model has no reasoning config", () => {
		expect(getReasoningOptions()).toEqual(["none", "simulated-thinking"]);
		expect(getDefaultReasoningEffort()).toBe("none");
	});

	it("uses configured effort levels and default", () => {
		const model: ModelConfigItem = {
			id: "reasoning-model",
			matchingModel: "reasoning-model",
			provider: "test",
			reasoningConfig: {
				supportedEffortLevels: ["low", "medium", "high"],
				defaultEffort: "high",
			},
		};

		expect(getReasoningOptions(model)).toEqual(["low", "medium", "high"]);
		expect(getDefaultReasoningEffort(model)).toBe("high");
	});

	it("formats labels for inline controls", () => {
		expect(formatReasoningLabel("none")).toBe("Instant");
		expect(formatReasoningLabel("simulated-thinking")).toBe("Simulated");
		expect(formatReasoningLabel("thinking")).toBe("Thinking");
		expect(formatReasoningLabel("high")).toBe("High");
	});
});
