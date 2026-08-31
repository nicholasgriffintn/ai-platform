import { toProviderMessages } from "~/lib/chat/messages/provider-mapping";
import type { ChatCompletionParameters, CoreChatOptions, Message, Platform } from "~/types";

import type { PreparedRequest } from "../preparation/RequestPreparer";

export interface ChatExecutionRequestInput {
  chatOptions: CoreChatOptions;
  prepared: PreparedRequest;
  messages: Message[];
  resolvedMaxSteps?: number;
}

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

  private providerBase() {
    const { chatOptions, prepared, messages, resolvedMaxSteps } = this.input;
    const stop = chatOptions.stop;

    return {
      app_url: chatOptions.app_url,
      system_prompt: prepared.systemPrompt,
      env: chatOptions.env,
      context: chatOptions.context,
      connectedConnectorProviders: prepared.connectedConnectorProviders,
      executionCtx: chatOptions.executionCtx,
      analyticsTrackingEnabled: prepared.userSettings?.tracking_enabled ?? null,
      disable_functions: chatOptions.disable_functions,
      completion_id: chatOptions.completion_id,
      conversation_type: chatOptions.conversation_type,
      messages: toProviderMessages(messages),
      message: prepared.messageWithContext,
      mode: prepared.currentMode,
      tool_policy_mode: chatOptions.tool_policy_mode,
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
      stop: stop ? (Array.isArray(stop) ? stop : [stop]) : undefined,
      logit_bias: chatOptions.logit_bias,
      metadata: chatOptions.metadata,
      reasoning_effort: chatOptions.reasoning_effort,
      verbosity: chatOptions.verbosity,
      cache_ttl_seconds: chatOptions.cache_ttl_seconds,
      use_responses: chatOptions.use_responses ?? (chatOptions.background ? true : undefined),
      background: chatOptions.background,
      previous_response_id: chatOptions.previous_response_id,
      auto_previous_response_id: chatOptions.auto_previous_response_id,
      conversation: chatOptions.conversation,
      input: chatOptions.input,
      input_items: chatOptions.input_items,
      text: chatOptions.text,
      include: chatOptions.include,
      include_defaults: chatOptions.include_defaults,
      include_encrypted_reasoning: chatOptions.include_encrypted_reasoning,
      truncation: chatOptions.truncation,
      prompt_cache_key: chatOptions.prompt_cache_key,
      prompt_cache_retention: chatOptions.prompt_cache_retention,
      max_tool_calls: chatOptions.max_tool_calls,
      safety_identifier: chatOptions.safety_identifier,
      service_tier: chatOptions.service_tier,
      stream_options: chatOptions.stream_options,
      tool_options: prepared.toolOptions,
      audio: chatOptions.audio,
      audio_format: chatOptions.audio_format,
      modalities: chatOptions.modalities,
      prediction: chatOptions.prediction,
      voice: chatOptions.voice,
      replicate_wait_seconds: chatOptions.replicate_wait_seconds,
      store: chatOptions.store ?? true,
      enabled_tools: this.enabledTools,
      approved_tools: chatOptions.approved_tools ?? [],
      require_approval_for: chatOptions.require_approval_for,
      enforce_mode_tool_policy: chatOptions.enforce_mode_tool_policy,
      tools: chatOptions.tools,
      parallel_tool_calls: chatOptions.parallel_tool_calls,
      tool_choice: chatOptions.tool_choice,
      current_step: chatOptions.current_step,
      max_steps: resolvedMaxSteps,
      options: prepared.requestOptions || {},
    };
  }
}

export function createChatExecutionRequest(input: ChatExecutionRequestInput): ChatExecutionRequest {
  return new ChatExecutionRequest(input);
}
