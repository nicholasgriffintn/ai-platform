import z from "zod/v4";

import { chatRunCommandReceiptSchema } from "../chat-runs.js";
import { messagePartsSchema } from "../message-parts.js";
import { modelTierSchema } from "../model-lineup.js";
import {
  responseAgentSchema,
  responseConversationSchema,
  responseEnvironmentSchema,
  responseIdempotencyKeySchema,
  responseIdSchema,
  responseSchema,
} from "../platform/responses.js";
import { responseToolsSchema } from "../platform/tools.js";
import { permissionModeSchema } from "../providers.js";
import { reasoningEffortSchema, reasoningSettingsSchema } from "../reasoning.js";
import {
  chatCompactionModeSchema,
  chatCompletionMessageSchema,
  chatCompletionToolSchema,
  chatResponseFormatSchema,
  chatToolChoiceSchema,
} from "../response-command.js";
import { runProvenanceSchema } from "../run-provenance.js";
import { messageSchema } from "../shared.js";

const recordSchema = z.record(z.string(), z.unknown());

export const chatCompletionResponseSchema = z.object({
  id: z.string(),
  object: z.string(),
  created: z.number(),
  model: z.string(),
  choices: z.array(
    z.object({
      index: z.number(),
      message: messageSchema,
      finish_reason: z.string().nullable(),
    }),
  ),
  usage: z
    .object({
      prompt_tokens: z.number(),
      completion_tokens: z.number(),
      total_tokens: z.number(),
    })
    .optional(),
  log_id: z.string().optional(),
  run: chatRunCommandReceiptSchema.optional(),
});

const chatCompactionPostProcessingMessageSchema = messageSchema.and(
  z.object({
    id: z.string().describe("Persisted compaction marker message ID."),
    role: z.literal("compaction").describe("Display-only compaction marker role."),
  }),
);

const chatPostProcessingSchema = z
  .object({
    guardrails: recordSchema.optional().describe("Guardrail result metadata."),
    compaction: z
      .object({
        message: chatCompactionPostProcessingMessageSchema.describe(
          "Persisted display-only compaction marker message.",
        ),
      })
      .describe("Conversation compaction metadata.")
      .optional(),
    steps: z.array(recordSchema).optional().describe("Tool step metadata."),
    total_usage: recordSchema.optional().describe("Aggregate usage across post-processing steps."),
  })
  .passthrough();

const chatCompletionResponseMessageSchema = z
  .object({
    id: z.string().optional().describe("Message identifier."),
    log_id: z.string().optional().describe("Provider or gateway log identifier."),
    role: z
      .enum(["developer", "system", "user", "assistant", "tool"])
      .describe("Response message role."),
    name: z.string().optional().describe("Tool or participant name."),
    content: z
      .union([z.string(), z.array(z.unknown()), recordSchema])
      .nullable()
      .optional()
      .describe("Response message content."),
    parts: messagePartsSchema.optional().describe("Assistant-native structured message parts."),
    data: recordSchema.nullable().optional().describe("Additional response message data."),
    tool_calls: z.array(recordSchema).optional().describe("Tool calls returned by the model."),
    tool_call_id: z.string().optional().describe("Tool call ID for tool-result messages."),
    tool_call_arguments: z
      .union([z.string(), recordSchema])
      .optional()
      .describe("Tool call arguments for tool-result messages."),
    citations: z
      .array(z.string())
      .nullable()
      .optional()
      .describe("Citations returned with the response."),
    status: z.string().optional().describe("Response message status."),
    timestamp: z
      .union([z.number(), z.string()])
      .optional()
      .describe("Message timestamp from runtime or persistence."),
    provenance: runProvenanceSchema.nullable().optional().describe("Where the run executed."),
  })
  .passthrough();

export const chatCompletionResponseBodySchema = z
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
          message: chatCompletionResponseMessageSchema.describe("Response message."),
          finish_reason: z.string().describe("Reason generation finished."),
        }),
      )
      .describe("Generated response choices."),
    usage: z
      .object({
        prompt_tokens: z.number().describe("Prompt token count."),
        completion_tokens: z.number().describe("Completion token count."),
        total_tokens: z.number().describe("Total token count."),
        input_tokens: z.number().optional().describe("Provider-normalised input token count."),
        output_tokens: z.number().optional().describe("Provider-normalised output token count."),
        cached_input_tokens: z
          .number()
          .optional()
          .describe("Input tokens served from the provider prompt cache."),
        cache_creation_tokens: z
          .number()
          .optional()
          .describe("Input tokens billed for writing to the provider prompt cache."),
        reasoning_tokens: z
          .number()
          .optional()
          .describe("Output tokens spent on reasoning or thinking."),
        audio_input_tokens: z.number().optional().describe("Audio input token count."),
        audio_output_tokens: z.number().optional().describe("Audio output token count."),
      })
      .describe("Token usage for the response."),
    post_processing: chatPostProcessingSchema.optional().describe("Post-processing metadata."),
    usage_limits: recordSchema.optional().describe("Usage limit metadata."),
    run: chatRunCommandReceiptSchema
      .optional()
      .describe("Persisted acknowledgement for the accepted run command."),
    response: responseSchema
      .optional()
      .describe("The Polychat Response this completion was rendered from, when one was run."),
  })
  .describe("Chat completion response.");

export type ChatCompletionResponseBody = z.input<typeof chatCompletionResponseBodySchema>;

export const chatCompletionsPortRequestSchema = z
  .object({
    messages: z.array(chatCompletionMessageSchema).min(1),
    model: z.string().min(1).optional(),
    models: z.array(z.string().min(1)).optional(),
    provider: z.string().min(1).optional(),
    stream: z.boolean().optional(),
    store: z.boolean().optional(),
    temperature: z.number().min(0).max(2).optional(),
    top_p: z.number().min(0).max(1).optional(),
    n: z.number().min(1).max(4).optional(),
    seed: z.number().optional(),
    stop: z.union([z.string(), z.array(z.string())]).optional(),
    max_tokens: z.number().optional(),
    max_completion_tokens: z.number().optional(),
    presence_penalty: z.number().min(-2).max(2).optional(),
    frequency_penalty: z.number().min(-2).max(2).optional(),
    logit_bias: z.record(z.string(), z.number()).optional(),
    logprobs: z.boolean().optional(),
    top_logprobs: z.number().int().min(0).max(20).optional(),
    user: z.string().optional(),
    metadata: z.record(z.string(), z.string()).optional(),
    reasoning_effort: reasoningEffortSchema.optional(),
    reasoning: reasoningSettingsSchema.optional(),
    verbosity: z.enum(["low", "medium", "high", "caveman"]).optional(),
    tools: z.union([z.array(chatCompletionToolSchema), responseToolsSchema]).optional(),
    tool_choice: chatToolChoiceSchema.optional(),
    parallel_tool_calls: z.boolean().optional(),
    response_format: chatResponseFormatSchema.optional(),
    service_tier: z.string().optional(),
    stream_options: recordSchema.optional(),
    web_search_options: recordSchema.optional(),
    audio: recordSchema.optional(),
    modalities: z.array(z.string()).optional(),
    prediction: recordSchema.optional(),
    prompt_cache_key: z.string().optional(),
    prompt_cache_retention: z.string().optional(),
    safety_identifier: z.string().optional(),
    conversation: responseConversationSchema.optional(),
    agent: responseAgentSchema.optional(),
    environment: responseEnvironmentSchema.optional(),
    model_tier: modelTierSchema.optional(),
    permission_mode: permissionModeSchema.optional(),
    compaction: chatCompactionModeSchema.optional(),
    mode: z.string().min(1).optional(),
    budget: z
      .object({ steps: z.number().int().min(1).optional() })
      .strict()
      .optional(),
    idempotency_key: responseIdempotencyKeySchema.optional(),
    response_id: responseIdSchema.optional(),
  })
  .strict()
  .superRefine((request, ctx) => {
    if (request.model && request.models?.length) {
      ctx.addIssue({
        code: "custom",
        path: ["models"],
        message: "Provide either model or models, not both",
      });
    }

    if (request.max_tokens !== undefined && request.max_completion_tokens !== undefined) {
      ctx.addIssue({
        code: "custom",
        path: ["max_completion_tokens"],
        message: "Provide only one of max_tokens or max_completion_tokens",
      });
    }
  });

export type ChatCompletionsPortRequest = z.input<typeof chatCompletionsPortRequestSchema>;
export type ParsedChatCompletionsPortRequest = z.output<typeof chatCompletionsPortRequestSchema>;
