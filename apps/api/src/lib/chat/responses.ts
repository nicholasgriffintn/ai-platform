import { getModelConfigByMatchingModel } from "~/lib/providers/models";
import { getChatProvider } from "~/lib/providers/capabilities/chat";
import type {
	AssistantMessageData,
	ChatCompletionParameters,
	Message,
} from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { generateId } from "~/utils/id";
import { getLogger } from "~/utils/logger";
import { formatMessages } from "~/utils/messages";
import {
	mergeParametersWithDefaults,
	shouldEnableStreaming,
} from "~/utils/parameters";
import { withRetry } from "~/utils/retries";

const logger = getLogger({ prefix: "lib/chat/responses" });

/**
 * Formats assistant message data into a standardized structure that can be used
 * by both streaming and non-streaming response handlers
 */
export function formatAssistantMessage({
	content = "",
	thinking = "",
	signature = "",
	citations = [],
	tool_calls = [],
	data = null,
	usage = null,
	guardrails = { passed: true },
	log_id = null,
	model = "",
	selected_models = [],
	platform = "api",
	timestamp = Date.now(),
	id = generateId(),
	finish_reason = null,
	mode,
	refusal = null,
	annotations = null,
}: Partial<AssistantMessageData>): AssistantMessageData {
	if (tool_calls && !Array.isArray(tool_calls)) {
		logger.warn("Invalid tool_calls format, expected array", {
			tool_calls,
		});
		tool_calls = [];
	}

	if (citations && !Array.isArray(citations)) {
		logger.warn("Invalid citations format, expected array", {
			citations,
		});
		citations = [];
	}

	if (typeof timestamp !== "number" || Number.isNaN(timestamp)) {
		logger.warn("Invalid timestamp, using current time", { timestamp });
		timestamp = Date.now();
	}

	const determinedFinishReason =
		finish_reason || (tool_calls?.length ? "tool_calls" : "stop");

	const finalUsage = usage || {
		prompt_tokens: 0,
		completion_tokens: 0,
		total_tokens: 0,
	};

	let messageContent: string | Array<any> = content;
	if (thinking || signature) {
		const contentBlocks = [];
		if (thinking) {
			contentBlocks.push({
				type: "thinking",
				thinking,
				signature: signature || "",
			});
		}
		if (content) {
			contentBlocks.push({
				type: "text",
				text: content,
			});
		}
		messageContent = contentBlocks;
	}

	return {
		content: messageContent,
		thinking,
		signature,
		citations,
		tool_calls,
		data,
		usage: finalUsage,
		guardrails,
		log_id,
		model,
		selected_models,
		platform,
		timestamp,
		id,
		finish_reason: determinedFinishReason,
		mode,
		refusal,
		annotations,
	};
}

export async function getAIResponse({
	app_url,
	system_prompt,
	env,
	user,
	mode,
	model,
	messages,
	message,
	enabled_tools,
	tools,
	...params
}: ChatCompletionParameters) {
	if (!model) {
		throw new AssistantError("Model is required", ErrorType.PARAMS_ERROR);
	}

	if (!messages || !Array.isArray(messages) || messages.length === 0) {
		throw new AssistantError(
			"Messages array is required and cannot be empty",
			ErrorType.PARAMS_ERROR,
		);
	}

	logger.debug("Getting AI response", { model, mode, user: user?.id });

	let modelConfig;
	try {
		modelConfig = await getModelConfigByMatchingModel(model);
		if (!modelConfig) {
			throw new AssistantError(
				`Model configuration not found for ${model}`,
				ErrorType.PARAMS_ERROR,
			);
		}
	} catch (error: any) {
		logger.error("Failed to get model configuration", { model, error });
		throw new AssistantError(
			`Invalid model configuration for ${model}: ${error.message}`,
			ErrorType.PARAMS_ERROR,
		);
	}

	let provider;
	try {
		provider = getChatProvider(modelConfig?.provider || "workers-ai", {
			env,
			user,
		});
	} catch (error: any) {
		logger.error("Failed to initialize provider", {
			provider: modelConfig?.provider,
			error,
		});
		throw new AssistantError(
			`Failed to initialize provider ${modelConfig?.provider}: ${error.message}`,
			ErrorType.PROVIDER_ERROR,
		);
	}

	const filteredMessages =
		mode === "normal"
			? messages.filter((msg: Message) => !msg.mode || msg.mode === "normal")
			: messages;

	if (filteredMessages.length === 0) {
		logger.warn("No messages after filtering", { mode });
		throw new AssistantError(
			"No valid messages after filtering",
			ErrorType.PARAMS_ERROR,
		);
	}

	let formattedMessages;
	try {
		formattedMessages = formatMessages(
			provider.name,
			filteredMessages,
			system_prompt,
			model,
		);
	} catch (error: any) {
		logger.error("Failed to format messages", { error });
		throw new AssistantError(
			`Failed to format messages: ${error.message}`,
			ErrorType.PARAMS_ERROR,
		);
	}

	const shouldStream = shouldEnableStreaming(
		modelConfig,
		provider.supportsStreaming,
		params.stream,
	);

	let parameters;
	try {
		parameters = mergeParametersWithDefaults({
			...params,
			model,
			messages: formattedMessages,
			message,
			mode,
			app_url,
			system_prompt,
			env,
			user,
			stream: shouldStream,
			enabled_tools,
			tools,
		});
	} catch (error: any) {
		logger.error("Failed to merge parameters", { error });
		throw new AssistantError(
			`Failed to prepare request parameters: ${error.message}`,
			ErrorType.PARAMS_ERROR,
		);
	}

	const startTime = Date.now();
	let response;
	try {
		// TODO: Make this smarter so we don't retry if the error is not retryable
		response = await withRetry(
			() => provider.getResponse(parameters, user?.id),
			{
				retryCount: 0,
				baseDelayMs: 1000,
			},
		);
	} catch (err: any) {
		let errorType = ErrorType.PROVIDER_ERROR;
		if (err.message?.includes("rate limit") || err.status === 429) {
			errorType = ErrorType.RATE_LIMIT_ERROR;
		} else if (err.status >= 500) {
			errorType = ErrorType.PROVIDER_ERROR;
		} else if (err.status === 401 || err.status === 403) {
			errorType = ErrorType.AUTHENTICATION_ERROR;
		}

		logger.error("Model invocation failed", {
			model,
			provider: provider.name,
			error: err,
			errorType,
		});

		throw new AssistantError(
			`${provider.name} error: ${err.message || "Unknown error"}`,
			errorType,
			err,
		);
	}
	const durationMs = Date.now() - startTime;
	const usageTokens =
		typeof response === "object" && response && "usage" in response
			? response.usage.total_tokens
			: null;
	logger.debug("Model invocation metrics", {
		model,
		provider: provider.name,
		durationMs,
		usageTokens,
	});

	if (!response) {
		throw new AssistantError(
			"Provider returned empty response",
			ErrorType.PROVIDER_ERROR,
		);
	}

	logger.debug("AI response received", { model, mode, user: user?.id });

	return response;
}
