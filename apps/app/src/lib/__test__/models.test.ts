import { describe, expect, it } from "vitest";

import type { ModelConfig } from "~/types";
import {
	getModelProvider,
	getModelsByMode,
	isTextInputChatModel,
	isTextOnlyModel,
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
		};

		expect(Object.keys(getModelsByMode(models, "remote"))).toEqual([
			"kimi-k2",
			"vision-chat",
			"text-to-image",
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

describe("isTextOnlyModel", () => {
	it("allows models with only text input and output", () => {
		expect(
			isTextOnlyModel({
				id: "deepseek-chat",
				name: "DeepSeek Chat",
				matchingModel: "deepseek-chat",
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
