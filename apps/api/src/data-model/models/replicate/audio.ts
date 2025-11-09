import type { ModelConfig } from "~/types";
import {
	createModelConfig,
	createModelConfigObject,
} from "~/lib/providers/models/utils";

const PROVIDER = "replicate";

export const replicateModelConfig: ModelConfig = createModelConfigObject([
	createModelConfig("replicate-musicgen", PROVIDER, {
		name: "MusicGen",
		matchingModel:
			"671ac645ce5e552cc63a54a2bbff63fcf798043055d2dac5fc9e36a837eedcfb",
		description:
			"Meta's MusicGen model for prompt-based music composition supporting conditioning on input audio clips.",
		type: ["text-to-audio"],
		strengths: ["creative", "audio", "text-to-audio"],
		supportsStreaming: false,
		supportsAttachments: true,
		costPerRun: 0.08,
		replicateInputSchema: {
			reference: "https://replicate.com/meta/musicgen",
			fields: [
				{
					name: "prompt",
					type: "string",
					description: "Natural language description of the desired music.",
					required: true,
				},
				{
					name: "input_audio",
					type: ["file", "string"],
					description:
						"Optional audio file URL or handle to condition the generation.",
				},
				{
					name: "duration",
					type: "number",
					description: "Desired duration of the generated music in seconds.",
					default: 8,
				},
				{
					name: "model_version",
					type: "string",
					description: "MusicGen checkpoint to use (melody, medium, large).",
					default: "stereo-melody-large",
					enum: [
						"melody-large",
						"stereo-large",
						"stereo-melody-large",
						"large",
					],
				},
				{
					name: "top_k",
					type: "integer",
					description: "Limits sampling to the most likely tokens.",
					default: 250,
				},
				{
					name: "top_p",
					type: "number",
					description: "Top-p nucleus sampling threshold.",
					default: 0,
				},
				{
					name: "temperature",
					type: "number",
					description: "Sampling temperature controlling randomness.",
					default: 1,
				},
				{
					name: "continuation",
					type: "boolean",
					description:
						"If `True`, generated music will continue from `input_audio`. Otherwise, generated music will mimic `input_audio`'s melody.",
					default: false,
				},
				{
					name: "continuation_start",
					type: "number",
					description: "Start time of the audio file to use for continuation.",
					default: 0,
				},
				{
					name: "continuation_end",
					type: "number",
					description:
						"End time of the audio file to use for continuation. If -1 or None, will default to the end of the audio clip.",
				},
				{
					name: "multi_band_diffusion",
					type: "boolean",
					description:
						"If `True`, the EnCodec tokens will be decoded with MultiBand Diffusion. Only works with non-stereo models.",
					default: false,
				},
				{
					name: "normalization_strategy",
					type: "string",
					description: "Strategy for normalizing audio.",
					default: "loudness",
					enum: ["loudness", "clip", "peak", "rms"],
				},
				{
					name: "classifier_free_guidance",
					type: "number",
					description:
						"Increases the influence of inputs on the output. Higher values produce lower-varience outputs that adhere more closely to inputs.",
					default: 3,
				},
				{
					name: "seed",
					type: "integer",
					description: "Random seed for reproducibility.",
				},
			],
		},
	}),

	createModelConfig("replicate-whisper-diarization", PROVIDER, {
		name: "Whisper Diarization",
		matchingModel:
			"cbd15da9f839c5f932742f86ce7def3a03c22e2b4171d42823e83e314547003f",
		description:
			"Blazing fast audio transcription with speaker diarization | Whisper Large V3 Turbo | word & sentence level timestamps | prompt ",
		type: ["audio-to-text"],
		strengths: ["ocr", "audio", "analysis"],
		supportsStreaming: false,
		supportsAttachments: true,
		costPerRun: 0.0058,
		replicateInputSchema: {
			reference: "https://replicate.com/thomasmol/whisper-diarization",
			fields: [
				{
					name: "file_string",
					type: ["string"],
					description: "Either provide: Base64 encoded audio file",
					required: false,
				},
				{
					name: "file_string",
					type: ["string"],
					description: "Or provide: A direct audio file URL",
					required: false,
				},
				{
					name: "file",
					type: ["file", "string"],
					description: "Or an audio file",
					required: false,
				},
				{
					name: "prompt",
					type: "string",
					description: "Natural language description of the desired music.",
					required: true,
				},
				{
					name: "num_speakers",
					type: "integer",
					description:
						"Number of distinct speakers expected in the transcription output.",
					default: 2,
				},
				{
					name: "language",
					type: "string",
					description: "Language spoken in the audio clip (ISO 639-1 code).",
					default: "en",
				},
				{
					name: "translate",
					type: "boolean",
					description: "Translate the audio into English during transcription.",
					default: false,
				},
				{
					name: "group_segments",
					type: "boolean",
					description: "Group short segments together for readability.",
					default: true,
				},
			],
		},
	}),
	createModelConfig("replicate-whisperx", PROVIDER, {
		name: "WhisperX",
		matchingModel:
			"826801120720e563620006b99e412f7ed7b991dd4477e9160473d44a405ef9d9",
		description:
			"Fast speech transcription with word-level timestamps and speaker diarization using Whisper large-v3.",
		type: ["audio-to-text"],
		strengths: ["ocr", "audio", "analysis"],
		supportsStreaming: false,
		supportsAttachments: true,
		costPerRun: 0.026,
		modalities: {
			input: ["audio"],
			output: ["text"],
		},
		replicateInputSchema: {
			reference: "https://replicate.com/victor-upmeet/whisperx",
			fields: [
				{
					name: "audio_file",
					type: ["file", "string"],
					description: "Audio file to transcribe.",
					required: true,
				},
				{
					name: "language",
					type: "string",
					description: "Language code (auto-detect if not specified).",
				},
				{
					name: "language_detection_min_prob",
					type: "integer",
					description:
						"If language is not specified, then the language will be detected recursively on different parts of the file until it reaches the given probability",
					default: 0,
				},
				{
					name: "language_detection_max_tries",
					type: "integer",
					description:
						"If language is not specified, then the language will be detected following the logic of language_detection_min_prob parameter, but will stop after the given max retries. If max retries is reached, the most probable language is kept.",
					default: 5,
				},
				{
					name: "initial_prompt",
					type: "string",
					description:
						"Optional text to provide as a prompt for the first window",
				},
				{
					name: "batch_size",
					type: "integer",
					description: "Batch size for transcription (1-64).",
					default: 64,
				},
				{
					name: "temperature",
					type: "integer",
					description: "Temperature to use for sampling",
					default: 0,
				},
				{
					name: "vad_onset",
					type: "integer",
					description: "VAD onset",
					default: 0.5,
				},
				{
					name: "vad_offset",
					type: "integer",
					description: "VAD offset",
					default: 0.383,
				},
				{
					name: "align_output",
					type: "boolean",
					description: "Enable word-level timestamp alignment.",
					default: true,
				},
				{
					name: "diarization",
					type: "boolean",
					description: "Assign speaker ID labels",
					default: false,
				},
				{
					name: "min_speakers",
					type: "integer",
					description: "Minimum number of speakers.",
				},
				{
					name: "max_speakers",
					type: "integer",
					description: "Maximum number of speakers.",
				},
			],
		},
	}),
	createModelConfig("replicate-stable-audio", PROVIDER, {
		name: "Stable Audio 2.5",
		matchingModel: "stability-ai/stable-audio-2.5",
		description:
			"Stability AI's text-to-audio model for generating high-quality music and sound effects.",
		type: ["text-to-audio"],
		strengths: ["creative", "audio", "text-to-audio"],
		supportsStreaming: false,
		supportsAttachments: false,
		costPerRun: 0.2,
		modalities: {
			input: ["text"],
			output: ["audio"],
		},
		replicateInputSchema: {
			reference: "https://replicate.com/stability-ai/stable-audio-2.5",
			fields: [
				{
					name: "prompt",
					type: "string",
					description: "Description of the audio to generate.",
					required: true,
				},
				{
					name: "duration",
					type: "number",
					description: "Duration in seconds (1-190).",
					default: 90,
				},
				{
					name: "steps",
					type: "integer",
					description:
						"Number of diffusion steps (higher = better quality but slower) (4-8).",
					default: 8,
				},
				{
					name: "cfg_scale",
					type: "number",
					description:
						"Classifier-free guidance scale (higher = more prompt adherence) (1-25).",
					default: 1,
				},
				{
					name: "seed",
					type: "integer",
					description: "Random seed.",
				},
			],
		},
	}),
	createModelConfig("replicate-elevenlabs-music", PROVIDER, {
		name: "ElevenLabs Music",
		matchingModel: "elevenlabs/music",
		description: "Compose a song from a prompt or a composition plan ",
		type: ["text-to-audio"],
		modalities: {
			input: ["text"],
			output: ["audio"],
		},
		costPerRun: 1,
		replicateInputSchema: {
			reference: "https://replicate.com/elevenlabs/music",
			fields: [
				{
					name: "prompt",
					type: "string",
					description: "Text prompt describing the desired music.",
					required: true,
				},
				{
					name: "music_length_ms",
					type: "integer",
					description: "Length of the generated music in milliseconds.",
					default: 30000,
				},
				{
					name: "force_instrumental",
					type: "boolean",
					description: "Whether to generate instrumental music without vocals.",
					default: false,
				},
			],
		},
	}),
]);
