import type { ModelConfigInfo } from "@assistant/schemas";
import type { StreamPostProcessingOptions } from "~/lib/chat/streaming";
import type { ChatCompletionParameters, CoreChatOptions, Message, Platform } from "~/types";
import type { PreparedRequest } from "../preparation/RequestPreparer";

export interface ChatExecutionRequestInput {
	chatOptions: CoreChatOptions;
	prepared: PreparedRequest;
	messages: Message[];
	resolvedMaxSteps?: number;
}

export type MultiModelStreamRequest = Omit<Partial<ChatCompletionParameters>, "models"> & {
	models: ModelConfigInfo[];
};

class ChatExecutionRequest {
	private readonly enabledTools: string[];
	private readonly platform: Platform;

	constructor(private readonly input: ChatExecutionRequestInput) {
		this.enabledTools = input.prepared.enabledTools ?? input.chatOptions.enabled_tools ?? [];
		this.platform = input.chatOptions.platform ?? "api";
	}

	providerRequest(): ChatCompletionParameters {
		return {
			...this.providerBase(),
			model: this.input.prepared.primaryModel,
			provider: this.input.prepared.primaryProvider,
			stream: this.input.chatOptions.stream ?? false,
		};
	}

	multiModelStreamRequest(): MultiModelStreamRequest {
		return {
			...this.providerBase(),
			models: this.input.prepared.modelConfigs,
			provider: this.input.prepared.primaryProvider,
			stream: true,
		};
	}

	streamOptions(model: string, provider: string): StreamPostProcessingOptions {
		const { chatOptions, prepared, resolvedMaxSteps } = this.input;

		return {
			env: chatOptions.env,
			completion_id: chatOptions.completion_id!,
			model,
			provider,
			platform: this.platform,
			user: chatOptions.user,
			context: chatOptions.context,
			userSettings: prepared.userSettings,
			app_url: chatOptions.app_url,
			mode: prepared.currentMode,
			max_steps: resolvedMaxSteps,
			current_step: chatOptions.current_step,
			tools: chatOptions.tools,
			enabled_tools: this.enabledTools,
			approved_tools: chatOptions.approved_tools ?? [],
			current_agent_id: chatOptions.current_agent_id,
			delegation_stack: chatOptions.delegation_stack,
			max_delegation_depth: chatOptions.max_delegation_depth,
			requestOptions: chatOptions.options || {},
		};
	}

	multiModelStreamOptions(): StreamPostProcessingOptions {
		return this.streamOptions(
			this.input.prepared.primaryModel,
			this.input.prepared.primaryProvider,
		);
	}

	private providerBase() {
		const { chatOptions, prepared, messages, resolvedMaxSteps } = this.input;

		return {
			app_url: chatOptions.app_url,
			system_prompt: prepared.systemPrompt,
			env: chatOptions.env,
			user: chatOptions.user?.id ? chatOptions.user : undefined,
			executionCtx: chatOptions.executionCtx,
			analyticsTrackingEnabled: prepared.userSettings?.tracking_enabled ?? null,
			disable_functions: chatOptions.disable_functions,
			completion_id: chatOptions.completion_id,
			messages,
			message: prepared.messageWithContext,
			mode: prepared.currentMode,
			should_think: chatOptions.should_think,
			response_format: chatOptions.response_format,
			lang: chatOptions.lang,
			temperature: chatOptions.temperature,
			max_tokens: chatOptions.max_tokens,
			top_p: chatOptions.top_p,
			top_k: chatOptions.top_k,
			seed: chatOptions.seed,
			repetition_penalty: chatOptions.repetition_penalty,
			frequency_penalty: chatOptions.frequency_penalty,
			presence_penalty: chatOptions.presence_penalty,
			n: chatOptions.n,
			stop: chatOptions.stop,
			logit_bias: chatOptions.logit_bias,
			metadata: chatOptions.metadata,
			reasoning_effort: chatOptions.reasoning?.effort ?? chatOptions.reasoning_effort,
			verbosity: chatOptions.verbosity,
			store: chatOptions.store ?? true,
			enabled_tools: this.enabledTools,
			approved_tools: chatOptions.approved_tools ?? [],
			tools: chatOptions.tools,
			parallel_tool_calls: chatOptions.parallel_tool_calls,
			tool_choice: chatOptions.tool_choice,
			current_step: chatOptions.current_step,
			max_steps: resolvedMaxSteps,
			options: chatOptions.options || {},
			current_agent_id: chatOptions.current_agent_id,
			delegation_stack: chatOptions.delegation_stack,
			max_delegation_depth: chatOptions.max_delegation_depth,
		};
	}
}

export function createChatExecutionRequest(input: ChatExecutionRequestInput): ChatExecutionRequest {
	return new ChatExecutionRequest(input);
}
