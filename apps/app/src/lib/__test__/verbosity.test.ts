import { describe, expect, it } from "vitest";

import { formatVerbosityLabel, getDefaultVerbosity, getVerbosityOptions } from "../verbosity";

describe("verbosity options", () => {
	it("uses low, medium, high, and caveman when the model has no config", () => {
		expect(getVerbosityOptions()).toEqual(["low", "medium", "high", "caveman"]);
		expect(getDefaultVerbosity()).toBe("medium");
	});

	it("uses configured levels and appends caveman", () => {
		expect(
			getVerbosityOptions({
				id: "custom-model",
				matchingModel: "custom-model",
				provider: "test",
				verbosityConfig: {
					supportedVerbosityLevels: ["low", "high"],
					defaultVerbosity: "high",
				},
			}),
		).toEqual(["low", "high", "caveman"]);
	});

	it("formats caveman for compact selectors", () => {
		expect(formatVerbosityLabel("caveman")).toBe("Caveman");
	});
});
