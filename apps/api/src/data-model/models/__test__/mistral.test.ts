import { describe, expect, it } from "vitest";

import { mistralModelConfig } from "../mistral";

describe("mistralModelConfig", () => {
	it("removes the deprecated devstral-latest alias and adds explicit aliases", () => {
		expect(mistralModelConfig["devstral-latest"]).toBeUndefined();
		expect(mistralModelConfig["devstral-2512"]?.matchingModel).toBe("devstral-2512");
		expect(mistralModelConfig["mistral-nemo"]?.matchingModel).toBe("mistral-nemo");
	});
});
