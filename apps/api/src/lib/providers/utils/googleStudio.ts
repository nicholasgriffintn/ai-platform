import type { ChatCompletionParameters, ModelConfigItem, ReasoningEffortLevel } from "~/types";
import { coerceStringArray, isRecord, omitUndefinedValues } from "~/utils/objects";
import { readOptionBag, readRecordOption } from "~/utils/options";
import { getEffectiveMaxTokens } from "~/utils/parameters";

const DEFAULT_TTS_VOICE = "Kore";
const GEMINI_THINKING_LEVELS = new Set<ReasoningEffortLevel>(["low", "medium", "high"]);

type GoogleResponseModality = "TEXT" | "IMAGE" | "AUDIO";

export const GOOGLE_STUDIO_SAFETY_SETTINGS = [
	{
		category: "HARM_CATEGORY_DANGEROUS_CONTENT",
		threshold: "BLOCK_NONE",
	},
	{ category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
	{ category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
	{
		category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
		threshold: "BLOCK_NONE",
	},
];

export function formatGoogleStudioContents(params: ChatCompletionParameters): any[] {
	return params.messages.map((message) => ({
		role: message.role === "assistant" ? "model" : message.role,
		parts: message.parts,
	}));
}

export function buildGoogleStudioSystemInstruction(
	systemPrompt: ChatCompletionParameters["system_prompt"],
) {
	if (!systemPrompt) {
		return undefined;
	}

	return {
		role: "system",
		parts: [
			{
				text: systemPrompt,
			},
		],
	};
}

export function buildGoogleStudioTools(
	params: ChatCompletionParameters,
	modelConfig: ModelConfigItem,
): Record<string, unknown>[] | undefined {
	const enabledTools = (params.enabled_tools || []).filter(
		(tool) => !(tool === "web_search" && modelConfig.supportsSearchGrounding),
	);
	const tools: Record<string, unknown>[] = [];

	if (modelConfig.supportsCodeExecution && enabledTools.includes("code_execution")) {
		tools.push({
			code_execution: {},
		});
	}

	if (modelConfig.supportsSearchGrounding && enabledTools.includes("search_grounding")) {
		tools.push({
			google_search: {},
		});
	}

	if (modelConfig.supportsUrlContext && enabledTools.includes("url_context")) {
		tools.push({
			url_context: {},
		});
	}

	if (modelConfig.supportsToolCalls && params.tools?.length > 0) {
		const formattedTools = params.tools.map((tool) => ({
			name: tool.function.name,
			description: tool.function.description,
			parameters: {
				type: tool.function.parameters.type,
				properties: tool.function.parameters.properties,
			},
			required: tool.function.required,
		}));
		tools.push({
			functionDeclarations: formattedTools,
		});
	}

	return tools.length > 0 ? tools : undefined;
}

export function buildGoogleStudioGenerationConfig(
	params: ChatCompletionParameters,
	modelConfig: ModelConfigItem,
): Record<string, unknown> {
	const responseModalities = getConfiguredResponseModalities(params, modelConfig);

	return omitUndefinedValues({
		temperature: params.temperature,
		maxOutputTokens: getEffectiveMaxTokens(params.max_tokens, modelConfig.maxTokens),
		topP: params.top_p,
		topK: params.top_k,
		seed: params.seed,
		repetitionPenalty: params.repetition_penalty,
		frequencyPenalty: params.frequency_penalty,
		presencePenalty: params.presence_penalty,
		stopSequences: params.stop,
		responseModalities,
		speechConfig: getConfiguredSpeechConfig(params, responseModalities),
		thinkingConfig: getConfiguredThinkingConfig(params, modelConfig),
		...getConfiguredResponseFormat(params, modelConfig),
	});
}

function getConfiguredResponseModalities(
	params: ChatCompletionParameters,
	modelConfig: ModelConfigItem,
): string[] | undefined {
	const options = readOptionBag(params.options);
	const configured = coerceStringArray(
		options.responseModalities ?? options.response_modalities,
	).map((modality) => modality.toUpperCase());

	if (configured.length > 0) {
		return Array.from(new Set(configured));
	}

	const outputs = modelConfig.modalities?.output ?? modelConfig.modalities?.input ?? ["text"];
	const responseModalities = outputs
		.map((modality) => {
			switch (modality) {
				case "text":
					return "TEXT";
				case "image":
					return "IMAGE";
				case "audio":
				case "speech":
					return "AUDIO";
				default:
					return undefined;
			}
		})
		.filter((modality): modality is GoogleResponseModality => !!modality);

	if (!responseModalities.some((modality) => modality !== "TEXT")) {
		return undefined;
	}

	return Array.from(new Set(responseModalities));
}

function getConfiguredSpeechConfig(
	params: ChatCompletionParameters,
	responseModalities: string[] | undefined,
): Record<string, unknown> | undefined {
	if (!responseModalities?.includes("AUDIO")) {
		return undefined;
	}

	const options = readOptionBag(params.options);
	const speechConfig = options.speechConfig ?? options.speech_config;
	if (isRecord(speechConfig)) {
		return speechConfig;
	}

	const audioOptions = readRecordOption(options, "audio");
	const voice =
		typeof audioOptions.voice === "string"
			? audioOptions.voice
			: typeof options.voice === "string"
				? options.voice
				: DEFAULT_TTS_VOICE;

	return {
		voiceConfig: {
			prebuiltVoiceConfig: {
				voiceName: voice,
			},
		},
	};
}

function getRequestedReasoningEffort(
	params: ChatCompletionParameters,
): ReasoningEffortLevel | undefined {
	if (params.thinking?.type === "disabled") {
		return "none";
	}

	if (params.thinking?.type === "enabled") {
		return "thinking";
	}

	return params.reasoning?.effort ?? params.reasoning_effort;
}

function getConfiguredThinkingConfig(
	params: ChatCompletionParameters,
	modelConfig: ModelConfigItem,
): Record<string, unknown> | undefined {
	const options = readOptionBag(params.options);
	const thinkingConfig = options.thinkingConfig ?? options.thinking_config;
	if (isRecord(thinkingConfig)) {
		return thinkingConfig;
	}

	const includeThoughts =
		options.includeThoughts === true || options.include_thoughts === true
			? { includeThoughts: true }
			: {};

	if (typeof params.thinking?.budget_tokens === "number") {
		return { thinkingBudget: params.thinking.budget_tokens, ...includeThoughts };
	}

	const effort = getRequestedReasoningEffort(params);
	if (!effort || effort === "simulated-thinking") {
		return undefined;
	}

	if (!modelConfig.reasoningConfig?.supportedEffortLevels?.includes(effort)) {
		return undefined;
	}

	if (params.model?.startsWith("gemini-3")) {
		if (effort === "none") {
			return { thinkingLevel: "minimal", ...includeThoughts };
		}

		if (effort === "thinking") {
			return { thinkingLevel: "high", ...includeThoughts };
		}

		if (GEMINI_THINKING_LEVELS.has(effort)) {
			return { thinkingLevel: effort, ...includeThoughts };
		}

		return undefined;
	}

	if (effort === "none") {
		return { thinkingBudget: 0, ...includeThoughts };
	}

	if (effort === "thinking") {
		return { thinkingBudget: -1, ...includeThoughts };
	}

	return undefined;
}

function getConfiguredResponseFormat(
	params: ChatCompletionParameters,
	modelConfig: ModelConfigItem,
): Record<string, unknown> {
	if (!modelConfig.supportsResponseFormat) {
		return {};
	}

	const options = readOptionBag(params.options);
	const providerResponseFormat = options.responseFormat ?? options.response_format;
	if (isRecord(providerResponseFormat)) {
		return { responseFormat: providerResponseFormat };
	}

	const responseFormat = params.response_format;
	if (!isRecord(responseFormat)) {
		return {};
	}

	if (isRecord(responseFormat.image)) {
		return { responseFormat };
	}

	if (responseFormat.type === "json_object") {
		return { responseMimeType: "application/json" };
	}

	if (responseFormat.type === "json_schema" && isRecord(responseFormat.json_schema)) {
		return {
			responseMimeType: "application/json",
			responseSchema: responseFormat.json_schema.schema,
		};
	}

	return {};
}
