import type { ConversationManager } from "~/lib/conversationManager";
import type { IFunction, IFunctionResponse, IRequest } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { getLogger } from "~/utils/logger";
import { handleFunctions } from "./index";

const logger = getLogger({ prefix: "services/functions/error_recovery" });

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const retry_with_backoff: IFunction = {
	name: "retry_with_backoff",
	description:
		"Retry a function call with exponential backoff if it fails. Useful for handling transient errors, rate limits, or network issues.",
	type: "normal",
	costPerCall: 0,
	parameters: {
		type: "object",
		properties: {
			function_name: {
				type: "string",
				description:
					"The name of the function to retry (e.g., 'call_api', 'web_search')",
			},
			args: {
				type: "object",
				description:
					"Arguments to pass to the function. Must match the parameter schema of the target function.",
			},
			max_attempts: {
				type: "number",
				description:
					"Maximum number of retry attempts (including initial call)",
				default: 3,
			},
			backoff_factor: {
				type: "number",
				description:
					"Multiplier for exponential backoff (in seconds). Delay = backoff_factor * (2 ^ attempt)",
				default: 1,
			},
			max_backoff: {
				type: "number",
				description: "Maximum backoff delay in seconds",
				default: 60,
			},
		},
		required: ["function_name", "args"],
	},
	function: async (
		completion_id: string,
		args: any,
		req: IRequest,
		app_url?: string,
		conversationManager?: ConversationManager,
	) => {
		logger.info("retry_with_backoff called with args:", { args });

		const {
			function_name,
			args: functionArgs,
			max_attempts = 3,
			backoff_factor = 1,
			max_backoff = 60,
		} = args || {};

		logger.info("Destructured values:", {
			function_name,
			functionArgs,
			functionArgsType: typeof functionArgs,
		});

		if (!function_name || typeof function_name !== "string") {
			throw new AssistantError(
				"function_name is required and must be a string. Example: { function_name: 'call_api', args: { url: '...' } }",
				ErrorType.PARAMS_ERROR,
			);
		}

		let parsedArgs = functionArgs;
		if (typeof functionArgs === "string") {
			try {
				parsedArgs = JSON.parse(functionArgs);
			} catch (error) {
				throw new AssistantError(
					"args must be valid JSON when provided as a string",
					ErrorType.PARAMS_ERROR,
				);
			}
		}

		if (!parsedArgs || typeof parsedArgs !== "object") {
			throw new AssistantError(
				"args is required and must be an object. Example: { function_name: 'call_api', args: { url: '...' } }",
				ErrorType.PARAMS_ERROR,
			);
		}

		const maxAttemptsNum = Math.max(1, Math.min(max_attempts, 10));
		const backoffFactorNum = Math.max(0.1, Math.min(backoff_factor, 10));
		const maxBackoffNum = Math.max(1, Math.min(max_backoff, 300));

		let lastError: Error | null = null;
		const attemptDetails: Array<{
			attempt: number;
			status: string;
			error?: string;
			delay?: number;
		}> = [];

		for (let attempt = 1; attempt <= maxAttemptsNum; attempt++) {
			try {
				logger.info("Attempting function call", {
					function_name,
					attempt,
					max_attempts: maxAttemptsNum,
				});

				const result = await handleFunctions({
					completion_id,
					app_url,
					functionName: function_name,
					args: parsedArgs,
					request: req,
					conversationManager,
				});

				attemptDetails.push({
					attempt,
					status: "success",
				});

				return {
					name: "retry_with_backoff",
					status: "success",
					content: `Function ${function_name} succeeded on attempt ${attempt}`,
					data: {
						function_name,
						attempts: attempt,
						result,
						attempt_details: attemptDetails,
					},
				};
			} catch (error) {
				lastError = error as Error;
				const errorMessage =
					error instanceof Error ? error.message : "Unknown error";

				logger.warn("Function call failed", {
					function_name,
					attempt,
					error_message: errorMessage,
				});

				attemptDetails.push({
					attempt,
					status: "error",
					error: errorMessage,
				});

				if (attempt < maxAttemptsNum) {
					const baseDelay = backoffFactorNum * 2 ** (attempt - 1);
					const delay = Math.min(baseDelay, maxBackoffNum);
					const delayMs = delay * 1000;

					attemptDetails[attemptDetails.length - 1].delay = delay;

					logger.info("Waiting before retry", {
						function_name,
						delay_seconds: delay,
						next_attempt: attempt + 1,
					});

					await sleep(delayMs);
				}
			}
		}

		return {
			name: "retry_with_backoff",
			status: "error",
			content: `Function ${function_name} failed after ${maxAttemptsNum} attempts: ${lastError?.message || "Unknown error"}`,
			data: {
				function_name,
				attempts: maxAttemptsNum,
				final_error: lastError?.message || "Unknown error",
				attempt_details: attemptDetails,
			},
		};
	},
};

export const fallback: IFunction = {
	name: "fallback",
	description:
		"Try a primary function, and if it fails, automatically call a fallback function instead. Useful for graceful degradation or trying alternative approaches.",
	type: "normal",
	costPerCall: 0,
	parameters: {
		type: "object",
		properties: {
			primary_function: {
				type: "string",
				description:
					"The name of the primary function to try first (e.g., 'research', 'web_search')",
			},
			primary_args: {
				type: "object",
				description:
					"Arguments for the primary function. Must match the parameter schema of the primary function.",
			},
			fallback_function: {
				type: "string",
				description:
					"The name of the fallback function to use if primary fails (e.g., 'web_search')",
			},
			fallback_args: {
				type: "object",
				description:
					"Arguments for the fallback function. Must match the parameter schema of the fallback function.",
			},
			include_primary_error: {
				type: "boolean",
				description:
					"Whether to include the primary function's error in the response",
				default: true,
			},
		},
		required: [
			"primary_function",
			"primary_args",
			"fallback_function",
			"fallback_args",
		],
	},
	function: async (
		completion_id: string,
		args: any,
		req: IRequest,
		app_url?: string,
		conversationManager?: ConversationManager,
	) => {
		const {
			primary_function,
			primary_args,
			fallback_function,
			fallback_args,
			include_primary_error = true,
		} = args || {};

		if (!primary_function || typeof primary_function !== "string") {
			throw new AssistantError(
				"primary_function is required and must be a string. Example: { primary_function: 'research', primary_args: { input: 'AI trends' }, fallback_function: 'web_search', fallback_args: { query: 'AI trends' } }",
				ErrorType.PARAMS_ERROR,
			);
		}

		if (!fallback_function || typeof fallback_function !== "string") {
			throw new AssistantError(
				"fallback_function is required and must be a string. Example: { primary_function: 'research', primary_args: { input: 'AI trends' }, fallback_function: 'web_search', fallback_args: { query: 'AI trends' } }",
				ErrorType.PARAMS_ERROR,
			);
		}

		let parsedPrimaryArgs = primary_args;
		if (typeof primary_args === "string") {
			try {
				parsedPrimaryArgs = JSON.parse(primary_args);
			} catch (error) {
				throw new AssistantError(
					"primary_args must be valid JSON when provided as a string",
					ErrorType.PARAMS_ERROR,
				);
			}
		}

		let parsedFallbackArgs = fallback_args;
		if (typeof fallback_args === "string") {
			try {
				parsedFallbackArgs = JSON.parse(fallback_args);
			} catch (error) {
				throw new AssistantError(
					"fallback_args must be valid JSON when provided as a string",
					ErrorType.PARAMS_ERROR,
				);
			}
		}

		if (!parsedPrimaryArgs || typeof parsedPrimaryArgs !== "object") {
			throw new AssistantError(
				"primary_args is required and must be an object",
				ErrorType.PARAMS_ERROR,
			);
		}

		if (!parsedFallbackArgs || typeof parsedFallbackArgs !== "object") {
			throw new AssistantError(
				"fallback_args is required and must be an object",
				ErrorType.PARAMS_ERROR,
			);
		}

		let primaryError: Error | null = null;

		try {
			logger.info("Attempting primary function", {
				primary_function,
			});

			const primaryResult = await handleFunctions({
				completion_id,
				app_url,
				functionName: primary_function,
				args: parsedPrimaryArgs,
				request: req,
				conversationManager,
			});

			return {
				name: "fallback",
				status: "success",
				content: `Primary function ${primary_function} succeeded`,
				data: {
					used_function: primary_function,
					result: primaryResult,
					fallback_triggered: false,
				},
			};
		} catch (error) {
			primaryError = error as Error;
			const errorMessage =
				error instanceof Error ? error.message : "Unknown error";

			logger.warn("Primary function failed, trying fallback", {
				primary_function,
				fallback_function,
				error_message: errorMessage,
			});
		}

		try {
			logger.info("Attempting fallback function", {
				fallback_function,
			});

			const fallbackResult = await handleFunctions({
				completion_id,
				app_url,
				functionName: fallback_function,
				args: parsedFallbackArgs,
				request: req,
				conversationManager,
			});

			const responseData: any = {
				used_function: fallback_function,
				result: fallbackResult,
				fallback_triggered: true,
			};

			if (include_primary_error && primaryError) {
				responseData.primary_error = primaryError.message;
			}

			return {
				name: "fallback",
				status: "success",
				content: `Fallback function ${fallback_function} succeeded after ${primary_function} failed`,
				data: responseData,
			};
		} catch (fallbackError) {
			const fallbackErrorMessage =
				fallbackError instanceof Error
					? fallbackError.message
					: "Unknown error";

			logger.error("Both primary and fallback functions failed", {
				primary_function,
				fallback_function,
				primary_error: primaryError?.message,
				fallback_error: fallbackErrorMessage,
			});

			return {
				name: "fallback",
				status: "error",
				content: `Both ${primary_function} and ${fallback_function} failed`,
				data: {
					primary_function,
					fallback_function,
					primary_error: primaryError?.message || "Unknown error",
					fallback_error: fallbackErrorMessage,
					fallback_triggered: true,
				},
			};
		}
	},
};
