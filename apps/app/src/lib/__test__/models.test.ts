import { describe, expect, it } from "vitest";

import type { ModelConfig, ModelConfigItem } from "@assistant/schemas";
import {
	createModelReferenceMap,
	doesModelMatchId,
	getChatAndRealtimeModelsByMode,
	getModelByReference,
	getModelInteractionCapabilities,
	getModelProvider,
	getModelsByMode,
	getRealtimeSessionModelsByProvider,
	getToolCallModels,
	isImageGenerationOutputModel,
	isModelSelectableForAccount,
	isStealthModel,
	isTextInputChatModel,
	isTextOnlyModel,
	modelHasOutputModality,
	modelSupportsVisualModality,
} from "../models";

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
			"vision-chat": {
				id: "vision-chat",
				name: "Vision Chat",
				matchingModel: "vision-chat",
				provider: "openai",
				modalities: { input: ["text", "image", "pdf"], output: ["text"] },
			},
			"text-to-image": {
				id: "text-to-image",
				name: "Text to Image",
				matchingModel: "text-to-image",
				provider: "openai",
				modalities: { input: ["text", "image"], output: ["image"] },
			},
			"audio-transcribe": {
				id: "audio-transcribe",
				name: "Audio Transcribe",
				matchingModel: "audio-transcribe",
				provider: "openai",
				modalities: { input: ["audio"], output: ["text"] },
			},
			"realtime-transcribe": {
				id: "realtime-transcribe",
				name: "Realtime Transcribe",
				matchingModel: "realtime-transcribe",
				provider: "mistral",
				modalities: { input: ["audio"], output: ["transcription"] },
				supportsRealtimeSession: true,
			},
		};

		expect(Object.keys(getModelsByMode(models, "remote"))).toEqual([
			"kimi-k2",
			"vision-chat",
			"text-to-image",
		]);
	});

	it("uses model visibility config instead of provider-specific exclusions", () => {
		const models: ModelConfig = {
			"configured-provider-model": {
				id: "configured-provider-model",
				name: "Configured Provider Model",
				matchingModel: "configured-provider-model",
				provider: "ollama",
				modalities: { input: ["text"], output: ["text"] },
			},
			"hidden-configured-provider-model": {
				id: "hidden-configured-provider-model",
				name: "Hidden Configured Provider Model",
				matchingModel: "hidden-configured-provider-model",
				provider: "ollama",
				modalities: { input: ["text"], output: ["text"] },
				hiddenFromDefaultList: true,
			},
		};

		expect(Object.keys(getModelsByMode(models, "remote"))).toEqual(["configured-provider-model"]);
	});
});

describe("isModelSelectableForAccount", () => {
	it("allows pro users to select paid catalogue models", () => {
		expect(isModelSelectableForAccount({ isFree: false }, true)).toBe(true);
	});

	it("allows non-pro users to select free or BYOK-enabled models only", () => {
		expect(isModelSelectableForAccount({ isFree: true }, false)).toBe(true);
		expect(isModelSelectableForAccount({ isFree: false, isByokEnabled: true }, false)).toBe(true);
		expect(isModelSelectableForAccount({ isFree: false, isByokEnabled: false }, false)).toBe(false);
	});
});

describe("getChatAndRealtimeModelsByMode", () => {
	it("combines normal chat models with realtime-only models", () => {
		const models: ModelConfig = {
			"chat-model": {
				id: "chat-model",
				name: "Chat Model",
				matchingModel: "chat-model",
				provider: "openai",
				modalities: { input: ["text"], output: ["text"] },
			},
			"realtime-only": {
				id: "realtime-only",
				name: "Realtime Only",
				matchingModel: "realtime-only",
				provider: "mistral",
				modalities: { input: ["audio"], output: ["transcription"] },
				supportsRealtimeSession: true,
			},
		};

		expect(Object.keys(getChatAndRealtimeModelsByMode(models, "remote"))).toEqual([
			"chat-model",
			"realtime-only",
		]);
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

describe("doesModelMatchId", () => {
	it("matches configured ids, provider ids, and display names", () => {
		const model = {
			id: "app-model",
			name: "Display Model",
			matchingModel: "provider/model",
			provider: "provider",
		} as ModelConfigItem;

		expect(doesModelMatchId(model, "app-model")).toBe(true);
		expect(doesModelMatchId(model, "provider/model")).toBe(true);
		expect(doesModelMatchId(model, "Display Model")).toBe(true);
		expect(doesModelMatchId(model, "other-model")).toBe(false);
		expect(doesModelMatchId(model, null)).toBe(false);
	});
});

describe("createModelReferenceMap", () => {
	it("indexes configured ids, provider ids, and display names", () => {
		const models: ModelConfig = {
			"app-model": {
				id: "app-model",
				name: "Display Model",
				matchingModel: "provider/model",
				provider: "provider",
			},
		};
		const modelReferences = createModelReferenceMap(models);

		expect(getModelByReference(modelReferences, "app-model")?.id).toBe("app-model");
		expect(getModelByReference(modelReferences, "provider/model")?.id).toBe("app-model");
		expect(getModelByReference(modelReferences, "Display Model")?.id).toBe("app-model");
		expect(getModelByReference(modelReferences, "other-model")).toBeUndefined();
		expect(getModelByReference(modelReferences, null)).toBeUndefined();
	});
});

describe("modelHasOutputModality", () => {
	it("uses input modalities as the default output modalities", () => {
		expect(
			modelHasOutputModality(
				{
					modalities: { input: ["text"] },
				},
				"text",
			),
		).toBe(true);
	});
});

describe("getModelInteractionCapabilities", () => {
	it("derives composer capabilities from model modalities and flags", () => {
		const capabilities = getModelInteractionCapabilities({
			id: "vision-chat",
			name: "Vision Chat",
			matchingModel: "vision-chat",
			provider: "openai",
			modalities: { input: ["text", "image"], output: ["text"] },
			supportsDocuments: true,
			supportsAudio: true,
			supportsToolCalls: true,
			supportsCodeExecution: true,
			supportsSearchGrounding: true,
		} as ModelConfigItem);

		expect(capabilities).toMatchObject({
			isMultimodalModel: true,
			isTextToImageOnlyModel: false,
			supportsAudio: true,
			supportsCode: true,
			supportsDocuments: true,
			supportsToolCalls: true,
			supportsCodeExecution: true,
			supportsSearchGrounding: true,
		});
	});

	it("disables native attachments for text-only image generation models", () => {
		const model = {
			id: "text-to-image",
			name: "Text to Image",
			matchingModel: "text-to-image",
			provider: "openai",
			modalities: { input: ["text"], output: ["image"] },
			supportsDocuments: true,
			supportsAudio: true,
		} as ModelConfigItem;

		expect(isImageGenerationOutputModel(model)).toBe(true);
		expect(getModelInteractionCapabilities(model)).toMatchObject({
			isTextToImageOnlyModel: true,
			supportsAudio: false,
			supportsCode: false,
			supportsDocuments: false,
		});
	});
});

describe("isStealthModel", () => {
	it("treats alpha status models as stealth models", () => {
		expect(
			isStealthModel({
				id: "openrouter/owl-alpha",
				name: "Owl Alpha",
				matchingModel: "openrouter/owl-alpha",
				provider: "openrouter",
				status: "alpha",
			} as ModelConfigItem),
		).toBe(true);
	});

	it("does not treat beta or unspecified status models as stealth models", () => {
		expect(
			isStealthModel({
				id: "preview-model",
				name: "Preview Model",
				matchingModel: "preview-model",
				provider: "provider",
				status: "beta",
			} as ModelConfigItem),
		).toBe(false);
		expect(isStealthModel(undefined)).toBe(false);
	});
});

describe("modelSupportsVisualModality", () => {
	it("detects visual input or output from model config", () => {
		expect(
			modelSupportsVisualModality({
				id: "image-output",
				name: "Image Output",
				matchingModel: "image-output",
				provider: "openai",
				modalities: { input: ["text"], output: ["image"] },
			} as ModelConfigItem),
		).toBe(true);

		expect(
			modelSupportsVisualModality({
				id: "text-only",
				name: "Text Only",
				matchingModel: "text-only",
				provider: "openai",
				modalities: { input: ["text"], output: ["text"] },
			} as ModelConfigItem),
		).toBe(false);
	});
});

describe("getRealtimeSessionModelsByProvider", () => {
	it("returns only realtime-capable models for the selected provider", () => {
		const models: ModelConfig = {
			"gpt-realtime-2": {
				id: "gpt-realtime-2",
				name: "GPT Realtime 2",
				matchingModel: "gpt-realtime-2",
				provider: "openai",
				modalities: { input: ["audio"], output: ["audio"] },
				supportsRealtimeSession: true,
			},
			"gpt-5.4": {
				id: "gpt-5.4",
				name: "GPT 5.4",
				matchingModel: "gpt-5.4",
				provider: "openai",
				modalities: { input: ["text"], output: ["text"] },
			},
			"gemini-live": {
				id: "gemini-live",
				name: "Gemini Live",
				matchingModel: "gemini-live",
				provider: "google-ai-studio",
				modalities: { input: ["audio", "video"], output: ["audio"] },
				supportsRealtimeSession: true,
			},
			"voxtral-mini-transcribe-realtime": {
				id: "voxtral-mini-transcribe-realtime",
				name: "Voxtral Mini Transcribe Realtime",
				matchingModel: "voxtral-mini-transcribe-realtime-2602",
				provider: "mistral",
				modalities: { input: ["audio"], output: ["transcription"] },
				supportsRealtimeSession: true,
			},
		};

		expect(Object.keys(getRealtimeSessionModelsByProvider(models, "openai"))).toEqual([
			"gpt-realtime-2",
		]);
		expect(Object.keys(getRealtimeSessionModelsByProvider(models, "mistral"))).toEqual([
			"voxtral-mini-transcribe-realtime",
		]);
		expect(Object.keys(getRealtimeSessionModelsByProvider(models))).toEqual([
			"gpt-realtime-2",
			"gemini-live",
			"voxtral-mini-transcribe-realtime",
		]);
	});
});

describe("getToolCallModels", () => {
	it("returns models that advertise tool call support", () => {
		const models: ModelConfig = {
			"agent-model": {
				id: "agent-model",
				name: "Agent Model",
				matchingModel: "agent-model",
				provider: "openai",
				supportsToolCalls: true,
			},
			"chat-model": {
				id: "chat-model",
				name: "Chat Model",
				matchingModel: "chat-model",
				provider: "openai",
				supportsToolCalls: false,
			},
		};

		expect(getToolCallModels(models)).toEqual({
			"agent-model": {
				id: "agent-model",
				name: "Agent Model",
				matchingModel: "agent-model",
				provider: "openai",
				supportsToolCalls: true,
			},
		});
	});
});

describe("isTextOnlyModel", () => {
	it("allows models with only text input and output", () => {
		expect(
			isTextOnlyModel({
				id: "deepseek-v4-flash",
				name: "DeepSeek Chat",
				matchingModel: "deepseek-v4-flash",
				provider: "deepseek",
				modalities: { input: ["text"], output: ["text"] },
			}),
		).toBe(true);
	});

	it("excludes multimodal and image output models", () => {
		expect(
			isTextOnlyModel({
				id: "vision-model",
				name: "Vision Model",
				matchingModel: "vision-model",
				provider: "openai",
				modalities: { input: ["text", "image"], output: ["text"] },
			}),
		).toBe(false);

		expect(
			isTextOnlyModel({
				id: "image-model",
				name: "Image Model",
				matchingModel: "image-model",
				provider: "replicate",
				modalities: { input: ["text"], output: ["image"] },
			}),
		).toBe(false);
	});
});

describe("isTextInputChatModel", () => {
	it("allows text input models with text or image output", () => {
		expect(
			isTextInputChatModel({
				id: "vision-chat",
				name: "Vision Chat",
				matchingModel: "vision-chat",
				provider: "openai",
				modalities: { input: ["text", "image", "pdf"], output: ["text"] },
			}),
		).toBe(true);

		expect(
			isTextInputChatModel({
				id: "text-to-image",
				name: "Text to Image",
				matchingModel: "text-to-image",
				provider: "openai",
				modalities: { input: ["text", "image"], output: ["image"] },
			}),
		).toBe(true);
	});

	it("excludes models without text input", () => {
		expect(
			isTextInputChatModel({
				id: "audio-transcribe",
				name: "Audio Transcribe",
				matchingModel: "audio-transcribe",
				provider: "openai",
				modalities: { input: ["audio"], output: ["text"] },
			}),
		).toBe(false);
	});
});
