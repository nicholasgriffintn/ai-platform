import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { getCachedWebLLMModels, loadWebLLMModels } from "~/lib/web-llm-models";
import { useWebLLMModels } from "../useWebLLMModels";

vi.mock("~/lib/web-llm-models", () => ({
	getCachedWebLLMModels: vi.fn(),
	loadWebLLMModels: vi.fn(),
}));

describe("useWebLLMModels", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(getCachedWebLLMModels).mockReturnValue({});
		vi.mocked(loadWebLLMModels).mockResolvedValue({
			"llama-local": {
				id: "llama-local",
				matchingModel: "llama-local",
				name: "Llama Local",
				provider: "web-llm",
				isFeatured: true,
				modalities: { input: ["text"], output: ["text"] },
			},
		});
	});

	it("does not request WebLLM models while disabled", () => {
		const { result } = renderHook(() => useWebLLMModels({ enabled: false }));

		expect(result.current).toEqual({});
		expect(loadWebLLMModels).not.toHaveBeenCalled();
	});
});
