import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useModels } from "~/hooks/useModels";
import { useWebLLMModels } from "~/hooks/useWebLLMModels";
import { useChatStore } from "~/state/stores/chatStore";
import type { ModelConfig } from "~/types";
import { useConversationModelOptions } from "../useConversationModelOptions";

vi.mock("~/hooks/useModels", () => ({
	useModels: vi.fn(),
}));

vi.mock("~/hooks/useWebLLMModels", () => ({
	useWebLLMModels: vi.fn(),
}));

const apiModels: ModelConfig = {
	"current-model": {
		id: "current-model",
		matchingModel: "current-model",
		name: "Claude Current",
		provider: "anthropic",
		isFeatured: true,
		modalities: { input: ["text"], output: ["text"] },
	},
	"source-model": {
		id: "source-model",
		matchingModel: "provider/source-model",
		name: "Source Model",
		provider: "openai",
		isFeatured: true,
		modalities: { input: ["text"], output: ["text"] },
	},
	"featured-alpha": {
		id: "featured-alpha",
		matchingModel: "featured-alpha",
		name: "Featured Alpha",
		provider: "openai",
		isFeatured: true,
		modalities: { input: ["text"], output: ["text"] },
	},
	"deepseek-chat": {
		id: "deepseek-chat",
		matchingModel: "deepseek-chat",
		name: "DeepSeek Chat",
		provider: "deepseek",
		isFeatured: false,
		modalities: { input: ["text"], output: ["text"] },
	},
	"image-output": {
		id: "image-output",
		matchingModel: "image-output",
		name: "Image Output",
		provider: "openai",
		isFeatured: true,
		modalities: { input: ["text"], output: ["image"] },
	},
	"voxtral-mini-transcribe-realtime": {
		id: "voxtral-mini-transcribe-realtime",
		matchingModel: "voxtral-mini-transcribe-realtime-2602",
		name: "Voxtral Mini Transcribe Realtime",
		provider: "mistral",
		isFeatured: true,
		modalities: { input: ["audio"], output: ["transcription"] },
		supportsRealtimeSession: true,
	},
};

const webLLMModels: ModelConfig = {
	"llama-local": {
		id: "llama-local",
		matchingModel: "llama-local",
		name: "Llama Local",
		provider: "web-llm",
		isFeatured: true,
		modalities: { input: ["text"], output: ["text"] },
	},
};

describe("useConversationModelOptions", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(useModels).mockReturnValue({
			data: apiModels,
			isLoading: false,
		} as ReturnType<typeof useModels>);
		vi.mocked(useWebLLMModels).mockReturnValue(webLLMModels);
		useChatStore.setState({
			chatMode: "remote",
			model: "current-model",
		});
	});

	it("builds featured and searchable remote options with exclusions", () => {
		const { result } = renderHook(() =>
			useConversationModelOptions({
				excludeCurrentModel: true,
				excludedModelIds: ["provider/source-model"],
				requiredOutputModality: "text",
			}),
		);

		expect(result.current.currentModel?.id).toBe("current-model");
		expect(result.current.featuredModels.map((model) => model.id)).toEqual(["featured-alpha"]);
		expect(result.current.searchModels("deep").map((model) => model.id)).toEqual(["deepseek-chat"]);
		expect(result.current.selectableModels.map((model) => model.id)).toEqual([
			"deepseek-chat",
			"featured-alpha",
		]);
		expect(result.current.selectableModels.map((model) => model.id)).not.toContain(
			"voxtral-mini-transcribe-realtime",
		);
	});

	it("uses local models when the conversation is in local mode", () => {
		useChatStore.setState({
			chatMode: "local",
			model: "llama-local",
		});

		const { result } = renderHook(() => useConversationModelOptions());

		expect(result.current.currentModel?.id).toBe("llama-local");
		expect(result.current.featuredModels.map((model) => model.id)).toEqual(["llama-local"]);
		expect(result.current.searchModels("deep")).toEqual([]);
	});
});
