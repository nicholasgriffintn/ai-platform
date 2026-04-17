import type { ModelConfig } from "~/types";
import {
	createModelConfig,
	createModelConfigObject,
} from "~/lib/providers/models/utils";

const PROVIDER = "workers-ai";

export const workersAiModelConfig: ModelConfig = createModelConfigObject([
	createModelConfig("workers-ai-assemblyai-universal-3-pro", PROVIDER, {
		name: "AssemblyAI Universal 3 Pro",
		matchingModel: "assemblyai/universal-3-pro",
		modalities: { input: ["audio"], output: ["text"] },
		inputSchema: {
			fields: [
				{
					name: "audio_url",
					type: ["file", "string"],
					description: "Public audio URL or data URI",
					required: true,
				},
				{
					name: "language_code",
					type: "string",
					description: "Language code",
				},
				{
					name: "language_detection",
					type: "boolean",
					description: "Enable automatic language detection",
				},
				{ name: "prompt", type: "string", description: "Transcription prompt" },
				{
					name: "keyterms_prompt",
					type: "array",
					description: "Key terms to boost",
				},
				{ name: "temperature", type: "number", description: "Temperature" },
				{
					name: "speaker_labels",
					type: "boolean",
					description: "Enable speaker labels",
				},
				{
					name: "speakers_expected",
					type: "integer",
					description: "Expected number of speakers",
				},
				{
					name: "auto_chapters",
					type: "boolean",
					description: "Enable automatic chapters",
				},
				{
					name: "entity_detection",
					type: "boolean",
					description: "Enable entity detection",
				},
				{
					name: "sentiment_analysis",
					type: "boolean",
					description: "Enable sentiment analysis",
				},
				{
					name: "auto_highlights",
					type: "boolean",
					description: "Enable automatic highlights",
				},
				{
					name: "content_safety",
					type: "boolean",
					description: "Enable content safety",
				},
				{
					name: "iab_categories",
					type: "boolean",
					description: "Enable IAB categories",
				},
				{
					name: "custom_spelling",
					type: "array",
					description: "Custom spelling rules",
				},
				{
					name: "webhook_url",
					type: "string",
					description: "Webhook URL",
				},
				{
					name: "audio_start_from",
					type: "integer",
					description: "Start timestamp in ms",
				},
				{
					name: "audio_end_at",
					type: "integer",
					description: "End timestamp in ms",
				},
			],
		},
	}),
	createModelConfig("workers-ai-openai-gpt-4o-transcribe", PROVIDER, {
		name: "GPT-4o Transcribe",
		matchingModel: "openai/gpt-4o-transcribe",
		modalities: { input: ["audio"], output: ["text"] },
		inputSchema: {
			fields: [
				{
					name: "file",
					type: ["file", "string"],
					description: "Audio file data URI",
					required: true,
				},
				{
					name: "language",
					type: "string",
					description: "ISO-639-1 language code",
				},
				{ name: "prompt", type: "string", description: "Optional prompt" },
				{
					name: "temperature",
					type: "number",
					description: "Sampling temperature",
					default: 0,
					required: true,
				},
			],
		},
	}),
]);
