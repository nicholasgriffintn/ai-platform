import { beforeEach, describe, expect, it, vi } from "vitest";

import { getModelConfigByMatchingModel } from "~/lib/providers/models";
import type { ModelConfigItem } from "@assistant/schemas";
import { MistralProvider } from "../mistral";

vi.mock("../base", () => ({
	BaseProvider: class MockBaseProvider {
		name = "mock";
		supportsStreaming = true;
		validateAiGatewayToken() {
			return true;
		}
		validateParams() {}
		async getApiKey() {
			return "test-key";
		}
		async defaultMapParameters() {
			return { model: "mistral-large-latest" };
		}
		buildAiGatewayHeaders() {
			return {};
		}
	},
}));

vi.mock("~/lib/providers/models", () => ({
	getModelConfigByMatchingModel: vi.fn(),
}));

const baseModelConfig: ModelConfigItem = {
	matchingModel: "mistral-large-latest",
	provider: "mistral",
	modalities: { input: ["text"], output: ["text"] },
};

describe("MistralProvider", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("uses the configured Mistral API operation for endpoints", async () => {
		vi.mocked(getModelConfigByMatchingModel).mockResolvedValue({
			...baseModelConfig,
			matchingModel: "codestral-embed",
			apiOperation: "codestralEmbeddings",
		});

		const provider = new MistralProvider();

		// @ts-expect-error - getEndpoint is protected
		await expect(provider.getEndpoint({ model: "codestral-embed", env: {} })).resolves.toBe(
			"v1/embeddings",
		);
	});

	it("maps embeddings from model operation config", async () => {
		vi.mocked(getModelConfigByMatchingModel).mockResolvedValue({
			...baseModelConfig,
			matchingModel: "mistral-embed",
			apiOperation: "embeddings",
		});

		const provider = new MistralProvider();
		const result = await provider.mapParameters({
			body: { input: "embed this" },
			env: {},
			model: "mistral-embed",
		} as any);

		expect(result).toEqual({
			model: "mistral-embed",
			input: "embed this",
		});
	});

	it("maps Codestral embeddings from model operation config", async () => {
		vi.mocked(getModelConfigByMatchingModel).mockResolvedValue({
			...baseModelConfig,
			matchingModel: "codestral-embed",
			apiOperation: "codestralEmbeddings",
		});

		const provider = new MistralProvider();
		const result = await provider.mapParameters({
			body: { input: "embed code" },
			env: {},
			model: "codestral-embed",
		} as any);

		expect(result).toEqual({
			model: "codestral-embed",
			input: "embed code",
			output_dimension: 1024,
			output_dtype: "binary",
		});
	});
});
