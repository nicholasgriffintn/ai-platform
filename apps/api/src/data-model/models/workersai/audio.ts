import type { ModelConfig } from "~/types";
import {
	createModelConfig,
	createModelConfigObject,
} from "~/lib/providers/models/utils";

const PROVIDER = "workers-ai";

export const workersAiModelConfig: ModelConfig = createModelConfigObject([
	createModelConfig("workers-ai-minimax-music-2-6", PROVIDER, {
		name: "MiniMax Music 2.6",
		matchingModel: "minimax/music-2.6",
		modalities: { input: ["text"], output: ["audio"] },
		inputSchema: {
			fields: [
				{
					name: "prompt",
					type: "string",
					description: "Music brief",
					required: true,
				},
				{ name: "lyrics", type: "string", description: "Optional lyrics" },
				{
					name: "sample_rate",
					type: "integer",
					description: "Audio sample rate",
					enum: [16000, 24000, 32000, 44100],
				},
				{
					name: "bitrate",
					type: "integer",
					description: "Audio bitrate",
					enum: [32000, 64000, 128000, 256000],
				},
				{
					name: "format",
					type: "string",
					description: "Audio format",
					enum: ["mp3", "wav"],
				},
				{
					name: "lyrics_optimizer",
					type: "boolean",
					description: "Generate lyrics automatically",
					default: false,
					required: true,
				},
				{
					name: "is_instrumental",
					type: "boolean",
					description: "Generate instrumental music",
					default: false,
					required: true,
				},
			],
		},
	}),
	createModelConfig("workers-ai-inworld-tts-1-5-mini", PROVIDER, {
		name: "Inworld TTS 1.5 Mini",
		matchingModel: "inworld/tts-1.5-mini",
		modalities: { input: ["text"], output: ["speech"] },
		inputSchema: {
			fields: [
				{
					name: "text",
					type: "string",
					description: "Text to synthesise",
					required: true,
				},
				{
					name: "voice_id",
					type: "string",
					description: "Voice identifier",
					default: "Dennis",
				},
				{
					name: "output_format",
					type: "string",
					description: "Output format",
					default: "mp3",
					enum: ["mp3", "opus", "wav", "flac"],
				},
				{ name: "bit_rate", type: "integer", description: "Bit rate" },
				{
					name: "sample_rate",
					type: "integer",
					description: "Sample rate",
					enum: [8000, 16000, 22050, 24000, 32000, 44100, 48000],
				},
				{
					name: "speaking_rate",
					type: "number",
					description: "Speaking rate",
				},
				{
					name: "temperature",
					type: "number",
					description: "Sampling temperature",
					default: 1,
				},
				{
					name: "timestamp_type",
					type: "string",
					description: "Timestamp granularity",
					default: "none",
					enum: ["none", "word", "character"],
				},
				{
					name: "apply_text_normalization",
					type: "boolean",
					description: "Apply text normalisation",
				},
			],
		},
	}),
	createModelConfig("workers-ai-inworld-tts-1-5-max", PROVIDER, {
		name: "Inworld TTS 1.5 Max",
		matchingModel: "inworld/tts-1.5-max",
		modalities: { input: ["text"], output: ["speech"] },
		inputSchema: {
			fields: [
				{
					name: "text",
					type: "string",
					description: "Text to synthesise",
					required: true,
				},
				{
					name: "voice_id",
					type: "string",
					description: "Voice identifier",
					default: "Dennis",
				},
				{
					name: "output_format",
					type: "string",
					description: "Output format",
					default: "mp3",
					enum: ["mp3", "opus", "wav", "flac"],
				},
				{ name: "bit_rate", type: "integer", description: "Bit rate" },
				{
					name: "sample_rate",
					type: "integer",
					description: "Sample rate",
					enum: [8000, 16000, 22050, 24000, 32000, 44100, 48000],
				},
				{
					name: "speaking_rate",
					type: "number",
					description: "Speaking rate",
				},
				{
					name: "temperature",
					type: "number",
					description: "Sampling temperature",
					default: 1,
				},
				{
					name: "timestamp_type",
					type: "string",
					description: "Timestamp granularity",
					default: "none",
					enum: ["none", "word", "character"],
				},
				{
					name: "apply_text_normalization",
					type: "boolean",
					description: "Apply text normalisation",
				},
			],
		},
	}),
	createModelConfig("workers-ai-minimax-speech-2-8-turbo", PROVIDER, {
		name: "MiniMax Speech 2.8 Turbo",
		matchingModel: "minimax/speech-2.8-turbo",
		modalities: { input: ["text"], output: ["speech"] },
		inputSchema: {
			fields: [
				{
					name: "text",
					type: "string",
					description: "Text to convert to speech",
					required: true,
				},
				{
					name: "voice_id",
					type: "string",
					description: "Voice identifier",
					default: "English_expressive_narrator",
					required: true,
				},
				{
					name: "speed",
					type: "number",
					description: "Speech speed",
					default: 1,
					required: true,
				},
				{
					name: "volume",
					type: "number",
					description: "Speech volume",
					default: 1,
					required: true,
				},
				{
					name: "pitch",
					type: "integer",
					description: "Pitch adjustment",
					default: 0,
					required: true,
				},
				{
					name: "emotion",
					type: "string",
					description: "Emotion control",
					enum: [
						"happy",
						"sad",
						"angry",
						"fearful",
						"disgusted",
						"surprised",
						"calm",
						"fluent",
					],
				},
				{
					name: "format",
					type: "string",
					description: "Audio format",
					default: "mp3",
					enum: ["mp3", "flac", "wav"],
					required: true,
				},
				{
					name: "sample_rate",
					type: "integer",
					description: "Sample rate",
					enum: [8000, 16000, 22050, 24000, 32000, 44100],
				},
			],
		},
	}),
	createModelConfig("workers-ai-openai-tts-1", PROVIDER, {
		name: "OpenAI TTS 1",
		matchingModel: "openai/tts-1",
		modalities: { input: ["text"], output: ["speech"] },
		inputSchema: {
			fields: [
				{
					name: "text",
					type: "string",
					description: "Text to generate audio for",
					required: true,
				},
				{
					name: "voice",
					type: "string",
					description: "Voice preset",
					default: "alloy",
					enum: ["alloy", "echo", "fable", "onyx", "nova", "shimmer"],
					required: true,
				},
				{
					name: "response_format",
					type: "string",
					description: "Response format",
					default: "mp3",
					enum: ["mp3", "opus", "wav", "aac", "flac"],
					required: true,
				},
				{
					name: "speed",
					type: "number",
					description: "Playback speed",
					default: 1,
					required: true,
				},
			],
		},
	}),
	createModelConfig("workers-ai-openai-tts-1-hd", PROVIDER, {
		name: "OpenAI TTS 1 HD",
		matchingModel: "openai/tts-1-hd",
		modalities: { input: ["text"], output: ["speech"] },
		inputSchema: {
			fields: [
				{
					name: "text",
					type: "string",
					description: "Text to generate audio for",
					required: true,
				},
				{
					name: "voice",
					type: "string",
					description: "Voice preset",
					default: "alloy",
					enum: ["alloy", "echo", "fable", "onyx", "nova", "shimmer"],
					required: true,
				},
				{
					name: "response_format",
					type: "string",
					description: "Response format",
					default: "mp3",
					enum: ["mp3", "opus", "wav", "aac", "flac"],
					required: true,
				},
				{
					name: "speed",
					type: "number",
					description: "Playback speed",
					default: 1,
					required: true,
				},
			],
		},
	}),
]);
