import z from "zod/v4";

import { chatRequestModeSchema } from "./agent-modes";
import { recipeChatRequestOptionsSchema, type RecipeChatRequestOptions } from "./apps";
import {
	conversationSandboxRequestOptionsSchema,
	conversationSmsRequestOptionsSchema,
} from "./chat-mode";
import { councilChatOptionsSchema } from "./council";
import { messagePartsSchema } from "./message-parts";
import { reasoningEffortSchema, reasoningSettingsSchema } from "./reasoning";
import { toolIdsSchema } from "./tools";

const recordSchema = z.record(z.string(), z.unknown());

export const modelRouterModeSchema = z.enum(["auto", "lite", "standard", "pro", "max"]);

export const chatHostedToolSettingsSchema = z
	.object({
		code_interpreter: recordSchema
			.optional()
			.describe("Settings for the hosted code interpreter tool."),
		web_search: recordSchema.optional().describe("Settings for the hosted web search tool."),
		file_search: recordSchema.optional().describe("Settings for the hosted file search tool."),
		mcp_servers: z
			.array(recordSchema)
			.optional()
			.describe("Hosted MCP server definitions available to the request."),
		computer_use: recordSchema.optional().describe("Settings for hosted computer-use tools."),
		image_generation: z
			.object({
				size: z.string().optional().describe("Requested generated image size."),
				quality: z.string().optional().describe("Requested generated image quality."),
			})
			.describe("Settings for hosted image generation.")
			.optional(),
		shell: z
			.object({
				environment: z
					.object({
						type: z.string().optional().describe("Shell environment type to request."),
					})
					.describe("Shell environment settings.")
					.optional(),
			})
			.describe("Settings for hosted shell execution.")
			.optional(),
		tool_search: recordSchema.optional().describe("Settings for hosted tool discovery."),
		responses_tools: z
			.array(recordSchema)
			.optional()
			.describe("Raw OpenAI Responses tool definitions."),
	})
	.passthrough();

export const chatRagOptionsSchema = z
	.object({
		top_k: z.number().optional().describe("Maximum number of retrieval results to include."),
		score_threshold: z
			.number()
			.optional()
			.describe("Minimum retrieval score required for an item."),
		include_metadata: z
			.boolean()
			.optional()
			.describe("Whether retrieved item metadata should be included."),
		type: z.string().optional().describe("Retrieval backend or strategy type."),
		namespace: z.string().optional().describe("Retrieval namespace to search."),
	})
	.passthrough();

export const chatMessageContentPartSchema = z
	.object({
		type: z
			.enum([
				"text",
				"image_url",
				"audio_url",
				"video_url",
				"input_audio",
				"thinking",
				"file",
				"tool_result",
				"document_url",
				"markdown_document",
			])
			.describe("Content part type."),
		text: z.string().optional().describe("Text content for text parts."),
		audio_url: z
			.object({ url: z.string().describe("Audio URL.") })
			.optional()
			.describe("Audio URL payload."),
		video_url: z
			.object({ url: z.string().describe("Video URL.") })
			.optional()
			.describe("Video URL payload."),
		thinking: z.string().optional().describe("Reasoning or thinking content."),
		signature: z.string().optional().describe("Provider signature for reasoning content."),
		image: z
			.union([z.array(z.number()), z.string()])
			.optional()
			.describe("Inline image payload."),
		tool_use_id: z.string().optional().describe("Tool use identifier."),
		id: z.string().optional().describe("Content part identifier."),
		name: z.string().optional().describe("Content part name."),
		content: z.string().optional().describe("Nested content payload."),
		input: z.union([z.string(), recordSchema]).optional().describe("Tool input payload."),
		cache_control: z
			.object({ type: z.literal("ephemeral").describe("Cache control type.") })
			.optional()
			.describe("Provider cache control settings."),
		document_url: z
			.object({
				url: z.url().describe("Document URL."),
				name: z.string().optional().describe("Display name for the document."),
			})
			.describe("Document URL payload for document_url parts.")
			.optional(),
		markdown_document: z
			.object({
				markdown: z.string().describe("Markdown document content."),
			})
			.describe("Markdown payload for markdown_document parts.")
			.optional(),
		image_url: z
			.object({
				url: z.string().describe("Image URL or data URL."),
				detail: z
					.enum(["auto", "low", "high"])
					.optional()
					.prefault("auto")
					.describe("Image detail level."),
			})
			.describe("Image payload for image_url parts.")
			.optional(),
		input_audio: z
			.object({
				data: z.string().optional().describe("Base64-encoded audio data."),
				format: z.enum(["wav", "mp3"]).optional().describe("Input audio format."),
			})
			.describe("Audio payload for input_audio parts.")
			.optional(),
		file: recordSchema.optional().describe("File payload for file parts."),
	})
	.refine(
		(part) => {
			if (part.type === "document_url") return !!part.document_url;
			if (part.type === "image_url") return !!part.image_url;
			if (part.type === "input_audio") return !!part.input_audio;
			if (part.type === "file") return !!part.file;
			if (part.type === "markdown_document") return !!part.markdown_document;
			return true;
		},
		{
			path: ["type"],
			error: "Field is required based on the specified type",
		},
	);

export const chatCompletionMessageSchema = z
	.object({
		role: z
			.enum(["developer", "system", "user", "assistant", "tool"])
			.describe("Message author role."),
		name: z.string().optional().describe("Optional participant name."),
		content: z
			.union([z.string(), z.array(chatMessageContentPartSchema), recordSchema])
			.nullable()
			.optional()
			.describe("OpenAI-compatible message content."),
		parts: messagePartsSchema.optional().describe("Assistant-native structured message parts."),
		refusal: z.string().optional().describe("Assistant refusal text when present."),
		tool_call_id: z.string().optional().describe("Tool call ID this message responds to."),
		tool_call_arguments: z.unknown().optional().describe("Parsed or raw tool call arguments."),
		tool_calls: z
			.array(
				z.object({
					id: z.string().describe("Tool call ID."),
					type: z.literal("function").describe("Tool call type."),
					function: z
						.object({
							name: z.string().describe("Function name to call."),
							arguments: z.union([z.string(), recordSchema]).describe("Function call arguments."),
						})
						.describe("Function tool call payload."),
				}),
			)
			.describe("Assistant tool calls requested by the model.")
			.optional(),
		status: z.string().optional().describe("Provider or application message status."),
		data: z.unknown().optional().describe("Additional message data."),
	})
	.superRefine((message, ctx) => {
		if (message.content !== undefined && message.parts !== undefined) {
			ctx.addIssue({
				code: "custom",
				path: ["parts"],
				message: "Provide either content or parts, not both",
			});
		}
	});

export const chatResponseFormatSchema = z.union([
	z.object({ type: z.literal("text").describe("Plain text response format.") }),
	z.object({ type: z.literal("json_object").describe("JSON object response format.") }),
	z.object({
		type: z.literal("json_schema").describe("JSON schema response format."),
		json_schema: z
			.object({
				name: z.string().describe("Response schema name."),
				strict: z.boolean().prefault(true).describe("Whether schema matching should be strict."),
				schema: recordSchema.describe("JSON schema definition."),
			})
			.describe("Structured JSON schema response settings."),
	}),
	z.object({
		image: recordSchema.describe("Provider-specific image response format settings."),
	}),
]);

export const chatCompletionToolSchema = z.object({
	type: z.literal("function").describe("Tool type."),
	function: z
		.object({
			name: z.string().describe("Function name."),
			description: z.string().optional().describe("Function description shown to the model."),
			parameters: recordSchema.optional().prefault({}).describe("Function parameters JSON schema."),
			required: z.array(z.string()).optional().describe("Required function parameter names."),
		})
		.describe("Function tool definition."),
});

export const chatCompletionFunctionSchema = z.object({
	name: z.string().describe("Function name."),
	description: z.string().optional().describe("Function description shown to the model."),
	parameters: recordSchema.optional().prefault({}).describe("Function parameters JSON schema."),
});

export const chatToolChoiceSchema = z.union([
	z.literal("none"),
	z.literal("auto"),
	z.literal("required"),
	z.object({
		type: z.literal("function").describe("Require a named function tool."),
		function: z
			.object({ name: z.string().describe("Function name to require.") })
			.describe("Required function tool."),
	}),
]);

const agentCompletionOptionsSchema = z.object({
	minToolCalls: z
		.number()
		.int()
		.min(0)
		.optional()
		.describe("Minimum number of tool calls to make before responding"),
});

export const chatRequestOptionsSchema = z
	.object({
		source: z.string().optional().describe("Request source marker for server-created flows."),
		council: councilChatOptionsSchema
			.optional()
			.describe("Settings for council mode, which enables multi-perspective responses."),
		sms: conversationSmsRequestOptionsSchema
			.optional()
			.describe("Settings for SMS mode, which enables SMS-based conversations."),
		recipe: recipeChatRequestOptionsSchema
			.optional()
			.describe("Settings for recipe mode, which enables connector-backed workflows."),
		agent: agentCompletionOptionsSchema
			.optional()
			.describe("Settings for agent mode, which enables multi-step reasoning and tool usage."),
		sandbox: conversationSandboxRequestOptionsSchema
			.optional()
			.describe(
				"Settings for sandbox mode, which enables code execution and tool usage in a secure environment.",
			),
	})
	.strict();

export const chatCompletionsRequestFieldsSchema = z.object({
	model: z.string().optional().describe("The model to use for the chat completion."),
	models: z
		.array(z.string().min(1))
		.optional()
		.describe("Explicit models to use for a multi-model chat completion."),
	provider: z
		.string()
		.optional()
		.describe("The provider to use when the model name is shared by multiple providers."),
	model_router_mode: modelRouterModeSchema
		.optional()
		.describe("Automatic router mode used when no explicit model is requested."),
	mode: chatRequestModeSchema
		.optional()
		.describe("The chat mode to use for default parameters and prompt configuration."),
	system_prompt: z
		.string()
		.optional()
		.describe("System instructions to apply to the request before the conversation messages."),
	messages: z
		.array(chatCompletionMessageSchema)
		.min(1, "messages array must not be empty")
		.describe("Conversation messages to send to the model."),
	should_think: z
		.boolean()
		.optional()
		.describe("Whether the model should think before responding when supported."),
	use_multi_model: z
		.boolean()
		.optional()
		.describe("Whether the request should run against multiple models."),
	temperature: z
		.number()
		.min(0)
		.max(2)
		.optional()
		.describe("Sampling temperature; higher values produce more varied responses."),
	top_p: z.number().min(0).max(1).optional().describe("Nucleus sampling probability."),
	top_k: z
		.number()
		.min(1)
		.max(100)
		.optional()
		.describe("Top-K sampling limit for providers that support it."),
	n: z.number().min(1).max(4).optional().describe("Number of completions to generate."),
	stream: z.boolean().optional().describe("Whether to stream the response."),
	stop: z
		.union([z.string(), z.array(z.string())])
		.optional()
		.describe("Stop sequence or sequences."),
	max_tokens: z
		.number()
		.optional()
		.describe(
			"Maximum output tokens; mutually exclusive with max_completion_tokens and max_output_tokens.",
		),
	max_completion_tokens: z
		.number()
		.optional()
		.describe(
			"Maximum output tokens for OpenAI reasoning models; mutually exclusive with max_tokens and max_output_tokens.",
		),
	presence_penalty: z
		.number()
		.min(-2)
		.max(2)
		.optional()
		.describe("Penalty for tokens already present in the prompt or completion."),
	frequency_penalty: z
		.number()
		.min(-2)
		.max(2)
		.optional()
		.describe("Penalty for repeated token frequency."),
	repetition_penalty: z
		.number()
		.min(0)
		.max(2)
		.optional()
		.describe("Penalty for repeated tokens on providers that support repetition penalties."),
	logit_bias: z.record(z.string(), z.number()).optional().describe("Provider token bias map."),
	logprobs: z.boolean().optional().describe("Whether to return token log probabilities."),
	top_logprobs: z
		.number()
		.int()
		.min(0)
		.max(20)
		.optional()
		.describe("Number of top token log probabilities to return."),
	user: z
		.string()
		.optional()
		.describe("OpenAI-compatible end-user identifier passed to providers when supported."),
	seed: z
		.number()
		.optional()
		.describe("Deterministic sampling seed for providers that support it."),
	metadata: z
		.record(z.string(), z.string())
		.optional()
		.describe("Provider metadata attached to the request."),
	reasoning_effort: reasoningEffortSchema
		.optional()
		.describe("Reasoning effort shortcut; mutually exclusive with reasoning."),
	reasoning: reasoningSettingsSchema
		.optional()
		.describe("Structured reasoning controls; mutually exclusive with reasoning_effort."),
	verbosity: z
		.enum(["low", "medium", "high", "caveman"])
		.optional()
		.describe("Desired response verbosity."),
	max_steps: z
		.number()
		.int()
		.min(1)
		.optional()
		.describe("Maximum sequential model/tool steps for agent-like modes."),
	budget_constraint: z
		.number()
		.optional()
		.describe("Optional budget constraint for model routing."),
	enabled_tools: toolIdsSchema.optional().describe("Tool IDs enabled for this request."),
	approved_tools: toolIdsSchema
		.optional()
		.describe("Tool IDs pre-approved for approval-gated modes."),
	tools: z.array(chatCompletionToolSchema).optional().describe("OpenAI-compatible function tools."),
	tool_choice: chatToolChoiceSchema.optional().describe("OpenAI-compatible tool choice."),
	functions: z
		.array(chatCompletionFunctionSchema)
		.optional()
		.describe("Deprecated OpenAI function definitions."),
	function_call: z
		.union([z.literal("none"), z.literal("auto"), z.object({ name: z.string() })])
		.optional()
		.describe("Deprecated OpenAI function choice."),
	parallel_tool_calls: z
		.boolean()
		.optional()
		.describe("Whether providers may call tools in parallel."),
	tool_options: chatHostedToolSettingsSchema
		.optional()
		.describe("Provider-hosted tool settings keyed by hosted tool name."),
	response_format: chatResponseFormatSchema
		.optional()
		.describe("OpenAI-compatible response format."),
	use_rag: z.boolean().optional().describe("Whether retrieval augmented generation is enabled."),
	rag_options: chatRagOptionsSchema.optional().describe("Retrieval augmented generation settings."),
	replicate_wait_seconds: z
		.number()
		.optional()
		.describe("Replicate Prefer wait value for async-capable predictions."),
	web_search_options: recordSchema.optional().describe("OpenAI-compatible web search options."),
	audio: recordSchema.optional().describe("OpenAI-compatible audio output options."),
	audio_format: z
		.string()
		.optional()
		.describe("Audio output format for providers that support it."),
	modalities: z
		.array(z.string())
		.optional()
		.describe("Output modalities requested from the provider."),
	prediction: recordSchema.optional().describe("OpenAI-compatible prediction hint."),
	service_tier: z.string().optional().describe("Provider service tier."),
	stream_options: recordSchema
		.optional()
		.describe("Streaming options passed to compatible providers."),
	voice: z.string().optional().describe("Voice for audio-capable responses."),
	cache_ttl_seconds: z
		.number()
		.min(0)
		.optional()
		.describe("Provider response cache TTL in seconds."),
	background: z.boolean().optional().describe("Whether to use OpenAI Responses background mode."),
	use_responses: z
		.boolean()
		.optional()
		.describe("Whether to force OpenAI Responses API use when supported."),
	previous_response_id: z.string().optional().describe("Explicit previous OpenAI response ID."),
	auto_previous_response_id: z
		.boolean()
		.optional()
		.describe("Whether to infer the previous OpenAI response ID from stored history."),
	conversation: z.unknown().optional().describe("OpenAI Responses conversation value."),
	input: z.unknown().optional().describe("Explicit OpenAI Responses input payload."),
	input_items: z.array(z.unknown()).optional().describe("Extra OpenAI Responses input items."),
	text: recordSchema.optional().describe("OpenAI Responses text settings."),
	include: z.array(z.string()).optional().describe("OpenAI Responses include list."),
	include_defaults: z
		.boolean()
		.optional()
		.describe("Whether default OpenAI Responses include values should be added."),
	include_encrypted_reasoning: z
		.boolean()
		.optional()
		.describe("Whether encrypted reasoning content should be included when supported."),
	truncation: z.string().optional().describe("OpenAI Responses truncation strategy."),
	prompt_cache_key: z.string().optional().describe("Prompt cache key for compatible providers."),
	prompt_cache_retention: z
		.string()
		.optional()
		.describe("Prompt cache retention for compatible providers."),
	max_output_tokens: z
		.number()
		.optional()
		.describe(
			"OpenAI Responses output token limit; equivalent to max_tokens and max_completion_tokens.",
		),
	max_tool_calls: z.number().optional().describe("Maximum provider tool calls."),
	safety_identifier: z.string().optional().describe("Provider safety identifier."),
	store: z.boolean().optional().describe("Whether to store the conversation and response."),
	completion_id: z.string().optional().describe("Existing or new completion ID."),
	platform: z
		.enum(["web", "mobile", "api", "obsidian", "dynamic-apps"])
		.optional()
		.describe("Client platform sending the request."),
	options: chatRequestOptionsSchema
		.optional()
		.describe("Grouped feature settings that are not model generation controls."),
});

export const partialChatCompletionsJsonSchema = chatCompletionsRequestFieldsSchema
	.partial()
	.strict();

export const createChatCompletionsJsonSchema = chatCompletionsRequestFieldsSchema
	.strict()
	.superRefine((request, ctx) => {
		if (!request.model && !request.models?.length && !request.model_router_mode) {
			ctx.addIssue({
				code: "custom",
				path: ["model"],
				message: "Either model or models must be provided",
			});
		}

		if (request.model && request.models?.length) {
			ctx.addIssue({
				code: "custom",
				path: ["models"],
				message: "Provide either model or models, not both",
			});
		}

		if (request.model_router_mode && (request.model || request.models?.length)) {
			ctx.addIssue({
				code: "custom",
				path: ["model_router_mode"],
				message: "model_router_mode is only valid when no explicit model is provided",
			});
		}

		if (request.models?.length && request.use_multi_model !== true) {
			ctx.addIssue({
				code: "custom",
				path: ["use_multi_model"],
				message: "use_multi_model must be true when models is provided",
			});
		}

		const tokenLimitFields = [
			request.max_tokens !== undefined ? "max_tokens" : undefined,
			request.max_completion_tokens !== undefined ? "max_completion_tokens" : undefined,
			request.max_output_tokens !== undefined ? "max_output_tokens" : undefined,
		].filter((field): field is string => field !== undefined);
		if (tokenLimitFields.length > 1) {
			ctx.addIssue({
				code: "custom",
				path: [tokenLimitFields[1] ?? "max_tokens"],
				message: "Provide only one of max_tokens, max_completion_tokens, or max_output_tokens",
			});
		}

		if (request.reasoning !== undefined && request.reasoning_effort !== undefined) {
			ctx.addIssue({
				code: "custom",
				path: ["reasoning_effort"],
				message: "Provide either reasoning or reasoning_effort, not both",
			});
		}
	});

export type ChatCompletionRequestBody = z.input<typeof createChatCompletionsJsonSchema>;
export type ModelRouterMode = z.infer<typeof modelRouterModeSchema>;

export const createChatCompletionsResponseSchema = z
	.object({
		id: z.string().describe("Completion identifier."),
		log_id: z.string().describe("Provider or gateway log identifier."),
		object: z.string().describe("OpenAI-compatible response object type."),
		created: z.number().describe("Response creation timestamp."),
		model: z.string().optional().describe("Model that generated the response."),
		choices: z
			.array(
				z.object({
					index: z.number().describe("Choice index."),
					message: z
						.object({
							role: z
								.enum(["developer", "system", "user", "assistant", "tool"])
								.describe("Response message role."),
							content: z
								.union([z.string(), z.array(z.unknown()), recordSchema])
								.describe("Response message content."),
							parts: messagePartsSchema
								.optional()
								.describe("Assistant-native structured message parts."),
							data: recordSchema.optional().describe("Additional response message data."),
							tool_calls: z
								.array(recordSchema)
								.optional()
								.describe("Tool calls returned by the model."),
							citations: z
								.array(z.string())
								.nullable()
								.optional()
								.describe("Citations returned with the response."),
							status: z.string().optional().describe("Response message status."),
						})
						.describe("Response message."),
					finish_reason: z.string().describe("Reason generation finished."),
				}),
			)
			.describe("Generated response choices."),
		usage: z
			.object({
				prompt_tokens: z.number().describe("Prompt token count."),
				completion_tokens: z.number().describe("Completion token count."),
				total_tokens: z.number().describe("Total token count."),
			})
			.describe("Token usage for the response."),
		post_processing: recordSchema.optional().describe("Post-processing metadata."),
		usage_limits: recordSchema.optional().describe("Usage limit metadata."),
	})
	.describe("Chat completion response.");

export type ChatCompletionResponseBody = z.input<typeof createChatCompletionsResponseSchema>;
export type ChatHostedToolSettings = z.input<typeof chatHostedToolSettingsSchema>;
export type ChatRequestOptions = z.input<typeof chatRequestOptionsSchema>;

export function parseChatRequestOptions(options: unknown): ChatRequestOptions | undefined {
	const parsed = chatRequestOptionsSchema.safeParse(options);
	return parsed.success ? parsed.data : undefined;
}

const recipeChatRequestOptionsEnvelopeSchema = z
	.object({
		recipe: recipeChatRequestOptionsSchema.optional(),
	})
	.passthrough();

export function readRecipeChatRequestOptions(
	options: unknown,
): RecipeChatRequestOptions | undefined {
	const parsed = recipeChatRequestOptionsEnvelopeSchema.safeParse(options);
	return parsed.success ? parsed.data.recipe : undefined;
}
