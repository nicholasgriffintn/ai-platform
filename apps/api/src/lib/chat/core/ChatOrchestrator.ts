import { createMultiModelStream } from "~/lib/chat/multiModalStreaming";
import { extractCouncilTurnRouting } from "~/lib/chat/council";
import { isAgentExecutionMode } from "~/lib/chat/mode-metadata";
import { RequestPreparer, type PreparedRequest } from "~/lib/chat/preparation/RequestPreparer";
import { createAgentExecutionStream } from "~/lib/chat/core/agent-stream";
import { buildStoredAssistantMessage } from "~/lib/chat/core/assistant-message";
import { createChatExecutionRequest } from "~/lib/chat/core/execution-request";
import { buildToolRequestContext } from "~/lib/chat/core/request-context";
import { getAIResponse } from "~/lib/chat/responses";
import { runAgentLoop, type ModelResponse } from "~/lib/chat/agent/runAgentLoop";
import { runNonStreamingToolSteps } from "~/lib/chat/core/tool-step-runner";
import { createStreamWithPostProcessing } from "~/lib/chat/streaming";
import { pruneMessagesToFitContext } from "~/lib/chat/utils";
import { ValidationPipeline } from "~/lib/chat/validation/ValidationPipeline";
import { resolveModeMaxSteps } from "~/lib/permissions/PermissionChecker";
import { Guardrails } from "~/lib/providers/capabilities/guardrails";
import { SessionManager } from "~/lib/session/SessionManager";
import { captureTrainingExample } from "~/lib/providers/capabilities/training/captureTrainingExample";
import { resolveServiceContext } from "~/lib/context/serviceContext";
import type { CoreChatOptions, Message } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { getLogger } from "~/utils/logger";
import { isAbortError } from "~/utils/abort";

const logger = getLogger({ prefix: "lib/chat/core/ChatOrchestrator" });
const RECIPE_CHAT_DEFAULT_MAX_STEPS = 4;

function resolveChatMaxSteps(chatOptions: CoreChatOptions): number | undefined {
	if (typeof chatOptions.max_steps === "number") {
		return chatOptions.max_steps;
	}

	return chatOptions.options?.recipe ? RECIPE_CHAT_DEFAULT_MAX_STEPS : undefined;
}

export class ChatOrchestrator {
	private validator: ValidationPipeline;
	private preparer: RequestPreparer;

	constructor(env: any) {
		this.validator = new ValidationPipeline();
		this.preparer = new RequestPreparer(env);
	}

	async process(options: CoreChatOptions) {
		try {
			const validationResult = await this.validator.validate(options);

			if (!validationResult?.validation?.isValid) {
				logger.warn("Validation failed", {
					error: validationResult.validation.error,
					type: validationResult.validation.validationType,
					completion_id: options.completion_id,
				});

				return {
					selectedModel: validationResult.context.modelConfig?.matchingModel || "unknown",
					validation: validationResult.validation.validationType || "input",
					error: validationResult.validation.error,
					violations: validationResult.validation.violations,
					rawViolations: validationResult.validation.rawViolations,
				};
			}

			const prepared = await this.preparer.prepare(options, validationResult.context);

			return this.executeRequest(options, prepared);
		} catch (error: any) {
			logger.error("Error in chat orchestration", {
				error,
				completion_id: options.completion_id,
				model: options.model,
			});

			if (error instanceof AssistantError) {
				throw error;
			}

			const errorType = this.determineErrorType(error);
			const errorMessage = this.getErrorMessage(error, errorType);
			const statusCode = error.status || error.statusCode || 500;

			throw new AssistantError(errorMessage, errorType, statusCode);
		}
	}

	private async executeRequest(chatOptions: CoreChatOptions, prepared: PreparedRequest) {
		const {
			platform = "api",
			stream = false,
			store = true,
			enabled_tools: requestedEnabledTools = [],
			approved_tools = [],
			max_steps,
		} = chatOptions;
		const resolvedMaxSteps = resolveChatMaxSteps(chatOptions);

		const startTime = Date.now();

		const {
			modelConfigs,
			primaryModel,
			primaryModelConfig,
			primaryProvider,
			conversationManager,
			messages: preparedMessages,
			systemPrompt,
			messageWithContext,
			userSettings,
			currentMode,
			enabledTools = requestedEnabledTools,
		} = prepared;
		const enabled_tools = enabledTools;

		const modelsToCheck = new Set(modelConfigs.map((config) => config.model));
		for (const modelToCheck of modelsToCheck) {
			await conversationManager.checkUsageLimits(modelToCheck);
		}

		let messages = preparedMessages;
		if (chatOptions.completion_id && messages.length > 0) {
			const sessionManager = new SessionManager({
				env: chatOptions.env,
				conversationManager,
				user: chatOptions.user?.id ? chatOptions.user : undefined,
			});
			const compactedSession = await sessionManager.compact({
				completionId: chatOptions.completion_id,
				messages,
				latestUserMessage: messageWithContext,
				mode: currentMode,
				modelConfig: {
					contextWindow: (primaryModelConfig as { contextWindow?: number })?.contextWindow,
				},
			});
			messages = compactedSession.messages;
		}
		messages = pruneMessagesToFitContext(messages, messageWithContext, primaryModelConfig);
		const executionRequest = createChatExecutionRequest({
			chatOptions,
			prepared: {
				...prepared,
				enabledTools: enabled_tools,
			},
			messages,
			resolvedMaxSteps,
		});

		if (!isAgentExecutionMode(currentMode) && modelConfigs.length > 1 && stream) {
			const transformedStream = createMultiModelStream(
				executionRequest.multiModelStreamRequest(),
				executionRequest.multiModelStreamOptions(),
				conversationManager,
			);

			return {
				stream: transformedStream,
				selectedModel: primaryModel,
				selectedModels: modelConfigs.map((m) => m.model),
				completion_id: chatOptions.completion_id,
			};
		}

		const requestParams = executionRequest.providerRequest();

		const toolRequestContext = buildToolRequestContext({
			chatOptions: {
				...chatOptions,
				approved_tools,
			},
			input: messageWithContext,
			mode: currentMode,
			model: primaryModel,
			provider: primaryProvider,
		});

		if (isAgentExecutionMode(currentMode) && stream) {
			return {
				stream: createAgentExecutionStream({
					requestParams,
					completionId: chatOptions.completion_id!,
					conversationManager,
					toolRequestContext,
					maxSteps: resolveModeMaxSteps(currentMode, max_steps),
					envLogId: chatOptions.env.AI.aiGatewayLogId,
					mode: currentMode,
					model: primaryModel,
					platform: platform || "api",
					requestOptions: chatOptions.options,
				}),
				selectedModel: primaryModel,
				completion_id: chatOptions.completion_id,
			};
		}

		const toolResponses: Message[] = [];
		let response: ModelResponse | ReadableStream;
		let responseAlreadyStored = false;
		if (isAgentExecutionMode(currentMode) && !stream) {
			const agentResult = await runAgentLoop({
				requestParams,
				completionId: chatOptions.completion_id!,
				conversationManager,
				toolRequestContext,
				maxSteps: resolveModeMaxSteps(currentMode, max_steps),
			});
			response = agentResult.response;
			toolResponses.push(...agentResult.toolResponses);
		} else {
			response = await getAIResponse(requestParams);
			if (!(response instanceof ReadableStream)) {
				const toolStepResult = await runNonStreamingToolSteps({
					response,
					requestParams,
					completionId: chatOptions.completion_id!,
					conversationManager,
					toolRequestContext,
					maxSteps: resolvedMaxSteps,
					buildAssistantMessage: (stepResponse) =>
						buildStoredAssistantMessage({
							response: stepResponse,
							content: stepResponse.response || "",
							envLogId: chatOptions.env.AI.aiGatewayLogId,
							mode: currentMode,
							model: primaryModel,
							platform: platform || "api",
							requestOptions: chatOptions.options,
						}),
				});
				response = toolStepResult.response;
				responseAlreadyStored = toolStepResult.responseAlreadyStored;
				toolResponses.push(...toolStepResult.toolResponses);
			}
		}

		if (response instanceof ReadableStream) {
			const transformedStream = await createStreamWithPostProcessing(
				response,
				executionRequest.streamOptions(primaryModel, primaryProvider),
				conversationManager,
			);

			return {
				stream: transformedStream,
				selectedModel: primaryModel,
				completion_id: chatOptions.completion_id,
			};
		}

		if (!response.response && !response.tool_calls) {
			throw new AssistantError("No response generated by the model", ErrorType.PARAMS_ERROR);
		}

		if (response.response) {
			const guardrails = new Guardrails(chatOptions.env, chatOptions.user, userSettings);
			const outputValidation = await guardrails.validateOutput(
				response.response,
				chatOptions.user?.id,
				chatOptions.completion_id,
			);

			if (!outputValidation?.isValid) {
				return {
					selectedModel: primaryModel,
					validation: "output",
					error:
						outputValidation.rawResponse?.blockedResponse || "Response did not pass safety checks",
					violations: outputValidation.violations,
					rawViolations: outputValidation.rawResponse,
				};
			}
		}

		const councilTurn = extractCouncilTurnRouting(
			response.response || "",
			chatOptions.options?.council,
		);
		if (!responseAlreadyStored) {
			await conversationManager.add(
				chatOptions.completion_id!,
				buildStoredAssistantMessage({
					response,
					content: councilTurn.content,
					envLogId: chatOptions.env.AI.aiGatewayLogId,
					mode: currentMode,
					model: primaryModel,
					platform: platform || "api",
					requestOptions: chatOptions.options,
					councilRouting: councilTurn.routing,
				}),
			);
		}

		if (userSettings?.tracking_enabled) {
			const userMessage = messages.find((m) => m.role === "user");
			if (userMessage && response.response && store) {
				const context = resolveServiceContext({
					env: chatOptions.env,
					user: chatOptions.user || undefined,
				});

				captureTrainingExample({
					context,
					source: "chat",
					userPrompt:
						typeof userMessage.content === "string"
							? userMessage.content
							: JSON.stringify(userMessage.content),
					assistantResponse: response.response,
					systemPrompt,
					modelUsed: primaryModel,
					conversationId: chatOptions.completion_id,
					startTime,
					skipEnhancement: true,
				}).catch((err) => {
					logger.error("Failed to capture training example", err);
				});
			}
		}

		return {
			response: { ...response, response: councilTurn.content },
			toolResponses,
			selectedModel: primaryModel,
			selectedModels: modelConfigs.length > 1 ? modelConfigs.map((m) => m.model) : undefined,
			completion_id: chatOptions.completion_id,
		};
	}

	private determineErrorType(error: any): ErrorType {
		if (
			error.name === "TimeoutError" ||
			isAbortError(error) ||
			error.code === "ECONNRESET" ||
			error.code === "ECONNABORTED" ||
			error.code === "ETIMEDOUT" ||
			error.code === "ENOTFOUND" ||
			error.code === "ECONNREFUSED" ||
			error.code === "ENETUNREACH"
		) {
			return ErrorType.NETWORK_ERROR;
		}

		if (
			error.status === 429 ||
			error.code === "RATE_LIMIT_EXCEEDED" ||
			error.name === "RateLimitError"
		) {
			return ErrorType.RATE_LIMIT_ERROR;
		}

		if (
			error.status === 401 ||
			error.status === 403 ||
			error.code === "UNAUTHORIZED" ||
			error.code === "FORBIDDEN" ||
			error.name === "AuthenticationError"
		) {
			return ErrorType.AUTHENTICATION_ERROR;
		}

		if (
			error.status >= 500 ||
			error.code === "MODEL_ERROR" ||
			error.code === "INVALID_PARAMETER" ||
			error.code === "TOKEN_LIMIT_EXCEEDED" ||
			error.code === "CONTEXT_LENGTH_EXCEEDED" ||
			error.name === "ModelError" ||
			error.name === "ProviderError"
		) {
			return ErrorType.PROVIDER_ERROR;
		}

		if (error.status >= 400 && error.status < 500) {
			return ErrorType.PARAMS_ERROR;
		}

		return ErrorType.UNKNOWN_ERROR;
	}

	private getErrorMessage(error: any, errorType: ErrorType): string {
		switch (errorType) {
			case ErrorType.NETWORK_ERROR:
				return "Connection error or timeout while communicating with AI provider";
			case ErrorType.RATE_LIMIT_ERROR:
				return "Rate limit exceeded. Please try again later.";
			case ErrorType.AUTHENTICATION_ERROR:
				return "Authentication error with AI provider";
			case ErrorType.PROVIDER_ERROR:
				return error.message || "Error with model parameters or provider";
			default:
				return "An unexpected error occurred";
		}
	}
}
