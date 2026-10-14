import { generateId, isRecord } from "@ngriffin_uk/polychat-utility-core";
import z from "zod/v4";

import { chatRetrySnapshotSchema } from "../chat-retries.js";
import type { ChatRunCommandReceipt } from "../chat-runs.js";
import { normaliseMessageParts, type MessagePart } from "../message-part-utils.js";
import { runProvenanceSchema, type RunProvenance } from "../run-provenance.js";
import {
  itemToMessage,
  messageToItem,
  storedItemSchema,
  toolCallItemSchema,
  type ItemMessageLike,
  type MessageItem,
  type StoredItem,
  type ToolCallItem,
} from "./items.js";
import { responseSchema, toResponse, type PlatformResponse } from "./responses.js";

const recordSchema = z.record(z.string(), z.unknown());
const activityStepSchema = z.number().int().positive();
const activityToolSchema = z.object({
  step: activityStepSchema,
  toolCallId: z.string().min(1),
  toolName: z.string().min(1),
});

export const responseActivityEventSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("turn_started") }),
  z.object({ kind: z.literal("model_step_started"), step: activityStepSchema }),
  z.object({
    kind: z.enum([
      "reasoning_started",
      "reasoning_finished",
      "response_started",
      "response_finished",
    ]),
    step: activityStepSchema,
  }),
  activityToolSchema.extend({
    kind: z.enum(["tool_input_started", "tool_input_finished", "tool_execution_started"]),
  }),
  activityToolSchema.extend({
    kind: z.literal("tool_finished"),
    outcome: z.enum(["success", "failure"]),
  }),
  activityToolSchema.extend({
    kind: z.literal("waiting_for_user"),
    reason: z.enum(["question", "approval", "selection", "takeover"]),
  }),
  z.object({
    kind: z.literal("model_step_finished"),
    step: activityStepSchema,
    outcome: z.enum(["tool_calls", "completed", "failed", "cancelled", "waiting"]),
  }),
  z.object({
    kind: z.literal("turn_finished"),
    outcome: z.enum(["completed", "failed", "cancelled", "waiting"]),
    errorType: z.string().min(1).optional(),
  }),
]);

export type ResponseActivityEvent = z.infer<typeof responseActivityEventSchema>;

export const RESPONSE_STREAM_EVENT_TYPES = [
  "response.created",
  "response.in_progress",
  "response.waiting",
  "response.completed",
  "response.failed",
  "response.cancelled",
  "response.incomplete",
  "response.status_changed",
  "response.phase",
  "response.retry",
  "response.activity",
  "response.agent_event",
  "response.state",
  "response.usage",
  "response.usage_limits",
  "response.output_item.added",
  "response.output_item.done",
  "response.content_part.done",
  "response.output_text.delta",
  "response.reasoning.delta",
  "response.reasoning.signature",
  "response.tool_call.arguments.delta",
  "response.tool_outputs.done",
  "response.error",
  "conversation.compacted",
  "conversation.title_changed",
] as const;

export const responseStreamEventTypeSchema = z.enum(RESPONSE_STREAM_EVENT_TYPES);

export type ResponseStreamEventType = z.infer<typeof responseStreamEventTypeSchema>;

export const responsePhaseSchema = z.enum(["init", "thinking", "post_processing", "done"]);

export type ResponsePhase = z.infer<typeof responsePhaseSchema>;

const envelopeFields = {
  sequence_number: z.number().int().nonnegative(),
  response_id: z.string().min(1).optional(),
  conversation_id: z.string().min(1).optional(),
};

const streamItemSchema = z.union([storedItemSchema, toolCallItemSchema]);

export const responseStreamEventSchema = z.union([
  z.object({ type: z.literal("response.created"), response: responseSchema, ...envelopeFields }),
  z.object({
    type: z.literal("response.in_progress"),
    response: responseSchema,
    ...envelopeFields,
  }),
  z.object({ type: z.literal("response.waiting"), response: responseSchema, ...envelopeFields }),
  z.object({ type: z.literal("response.completed"), response: responseSchema, ...envelopeFields }),
  z.object({ type: z.literal("response.failed"), response: responseSchema, ...envelopeFields }),
  z.object({ type: z.literal("response.cancelled"), response: responseSchema, ...envelopeFields }),
  z.object({
    type: z.literal("response.incomplete"),
    response: responseSchema,
    ...envelopeFields,
  }),
  z.object({
    type: z.literal("response.status_changed"),
    response: responseSchema,
    ...envelopeFields,
  }),
  z.object({ type: z.literal("response.phase"), phase: responsePhaseSchema, ...envelopeFields }),
  z.object({
    type: z.literal("response.retry"),
    retry: chatRetrySnapshotSchema.nullable(),
    ...envelopeFields,
  }),
  ...responseActivityEventSchema.options.map((activity) =>
    activity.extend({ type: z.literal("response.activity"), ...envelopeFields }),
  ),
  z.object({ type: z.literal("response.agent_event"), event: recordSchema, ...envelopeFields }),
  z
    .object({ type: z.literal("response.state"), state: z.string().min(1), ...envelopeFields })
    .passthrough(),
  z.object({ type: z.literal("response.usage"), usage: z.unknown(), ...envelopeFields }),
  z.object({
    type: z.literal("response.usage_limits"),
    usage_limits: z.unknown(),
    ...envelopeFields,
  }),
  z.object({
    type: z.literal("response.output_item.added"),
    output_index: z.number().int().nonnegative(),
    item: streamItemSchema,
    ...envelopeFields,
  }),
  z.object({
    type: z.literal("response.output_item.done"),
    output_index: z.number().int().nonnegative(),
    item: streamItemSchema,
    finish_reason: z.string().nullable().optional(),
    ...envelopeFields,
  }),
  z.object({
    type: z.literal("response.content_part.done"),
    item_id: z.string().min(1),
    ...envelopeFields,
  }),
  z.object({
    type: z.literal("response.output_text.delta"),
    item_id: z.string().min(1),
    output_index: z.number().int().nonnegative(),
    delta: z.string(),
    ...envelopeFields,
  }),
  z.object({
    type: z.literal("response.reasoning.delta"),
    item_id: z.string().min(1),
    output_index: z.number().int().nonnegative(),
    delta: z.string(),
    ...envelopeFields,
  }),
  z.object({
    type: z.literal("response.reasoning.signature"),
    item_id: z.string().min(1),
    signature: z.string(),
    ...envelopeFields,
  }),
  z.object({
    type: z.literal("response.tool_call.arguments.delta"),
    item_id: z.string().min(1),
    call_id: z.string().min(1),
    delta: z.union([z.string(), recordSchema]),
    ...envelopeFields,
  }),
  z.object({ type: z.literal("response.tool_outputs.done"), ...envelopeFields }),
  z.object({
    type: z.literal("response.error"),
    error: z.unknown(),
    code: z.string().optional(),
    ...envelopeFields,
  }),
  z.object({
    type: z.literal("conversation.compacted"),
    item: storedItemSchema,
    ...envelopeFields,
  }),
  z.object({
    type: z.literal("conversation.title_changed"),
    title: z.string(),
    ...envelopeFields,
  }),
]);

export type ResponseStreamEvent = z.infer<typeof responseStreamEventSchema>;

type ResponseEnvelopeKey = "sequence_number" | "response_id" | "conversation_id" | "output_index";

type WithoutEnvelope<TEvent> = {
  [TKey in keyof TEvent as TKey extends ResponseEnvelopeKey ? never : TKey]: TEvent[TKey];
};

export type ResponseEventInput = ResponseStreamEvent extends infer TEvent
  ? TEvent extends ResponseStreamEvent
    ? WithoutEnvelope<TEvent>
    : never
  : never;

export const RESPONSE_STREAM_MAX_EVENT_BYTES = 4 * 1024 * 1024;
export const RESPONSE_STREAM_PROGRESS_BATCH_EVENTS = 64;
export const RESPONSE_STREAM_TOOL_PREVIEW_CHARACTERS = 32 * 1024;

const progressEventTypes: ReadonlySet<string> = new Set([
  "response.output_text.delta",
  "response.reasoning.delta",
  "response.reasoning.signature",
  "response.tool_call.arguments.delta",
]);

export type ParsedResponseStreamEvent = Record<string, unknown> | { type: "done" };

export interface ParsedResponseStreamBuffer {
  events: ParsedResponseStreamEvent[];
  remainingBuffer: string;
}

export function isResponseStreamProgressEvent(event: ParsedResponseStreamEvent): boolean {
  return typeof event.type === "string" && progressEventTypes.has(event.type);
}

export function parseResponseStreamSseEvent(block: string): ParsedResponseStreamEvent | null {
  const dataLines = block
    .split("\n")
    .map((line) => line.trimEnd())
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trimStart());

  if (dataLines.length === 0) {
    return null;
  }

  const payload = dataLines.join("\n").trim();

  if (!payload) {
    return null;
  }

  if (payload === "[DONE]") {
    return { type: "done" };
  }

  let rawParsed: unknown;

  try {
    rawParsed = JSON.parse(payload);
  } catch {
    return null;
  }

  return isRecord(rawParsed) ? rawParsed : null;
}

function exceedsUtf8ByteLimit(value: string, maximumBytes: number): boolean {
  if (value.length > maximumBytes) {
    return true;
  }

  if (value.length * 3 <= maximumBytes) {
    return false;
  }

  return new TextEncoder().encode(value).byteLength > maximumBytes;
}

export function parseResponseStreamSseBuffer(
  buffer: string,
  options: { flush?: boolean; maxEventBytes?: number } = {},
): ParsedResponseStreamBuffer {
  const blocks = buffer.split(/\r?\n\r?\n/);
  const trailingBuffer = blocks.pop() || "";
  const maxEventBytes = options.maxEventBytes ?? RESPONSE_STREAM_MAX_EVENT_BYTES;

  if (exceedsUtf8ByteLimit(trailingBuffer, maxEventBytes)) {
    throw new RangeError(`Response stream event exceeded ${maxEventBytes} bytes`);
  }

  const completeBlocks =
    options.flush && trailingBuffer.trim() ? [...blocks, trailingBuffer] : blocks;
  const events = completeBlocks.flatMap((block): ParsedResponseStreamEvent[] => {
    if (!block.trim()) {
      return [];
    }

    if (exceedsUtf8ByteLimit(block, maxEventBytes)) {
      throw new RangeError(`Response stream event exceeded ${maxEventBytes} bytes`);
    }

    const event = parseResponseStreamSseEvent(`${block}\n\n`);

    return event ? [event] : [];
  });

  return {
    events,
    remainingBuffer: options.flush ? "" : trailingBuffer,
  };
}

export function formatResponseStreamSseEvent(event: Record<string, unknown>): string {
  const type = typeof event.type === "string" ? event.type : "response.state";

  return `event: ${type}\ndata: ${JSON.stringify(event)}\n\n`;
}

export function formatResponseStreamSseDone(): string {
  return "data: [DONE]\n\n";
}

export interface ResponseStreamToolCall {
  id?: string;
  type?: "function";
  function: {
    name: string;
    arguments: string | Record<string, unknown>;
  };
  index?: number;
}

export interface ResponseStreamMessage {
  role: "assistant" | "tool";
  content: string | unknown[];
  parts?: MessagePart[];
  reasoning?: {
    collapsed: boolean;
    content: string;
  };
  id: string;
  created?: number;
  timestamp?: number;
  model?: string;
  provider?: string;
  platform?: string;
  citations?: string[] | null;
  usage?: unknown;
  log_id?: string;
  name?: string;
  tool_call_id?: string;
  tool_call_arguments?: string | Record<string, unknown>;
  tool_calls?: ResponseStreamToolCall[];
  status?: string | null;
  data?: unknown;
  provenance?: RunProvenance | null;
}

export type ResponseStreamUpdate =
  | { type: "response"; response: PlatformResponse; event: ResponseStreamEventType }
  | { type: "assistant_metadata"; message: ResponseStreamMessage }
  | { type: "assistant_delta"; content: string; reasoning?: string }
  | { type: "assistant_final"; message: ResponseStreamMessage }
  | { type: "tool_result"; message: ResponseStreamMessage }
  | { type: "tool_call_started"; toolCallId: string; toolName: string }
  | { type: "tool_call_finished"; toolCallId: string }
  | { type: "activity"; activity: ResponseActivityEvent }
  | { type: "usage"; usage: unknown }
  | { type: "usage_limits"; usageLimits: unknown }
  | { type: "error"; error: unknown; code?: string }
  | { type: "state"; state: string; event: Record<string, unknown> }
  | { type: "done"; message?: ResponseStreamMessage };

export interface ResponseStreamAssemblerOptions {
  model?: string;
  createId?: () => string;
  now?: () => number;
}

export interface ResponseStreamAssembler {
  ingest(event: unknown): ResponseStreamUpdate[];
  getFinalMessage(): ResponseStreamMessage | undefined;
  getResponse(): PlatformResponse | undefined;
}

interface PendingToolCall {
  id: string;
  name: string;
  parameterFragments: string[];
  parameters: Record<string, unknown>;
}

function defaultCreateId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return generateId();
  }

  return `msg_${Math.random().toString(36).slice(2)}`;
}

function readStringArrayOrNull(value: unknown): string[] | null | undefined {
  if (value === null) {
    return null;
  }

  return Array.isArray(value) && value.every((item) => typeof item === "string")
    ? value
    : undefined;
}

function readToolCall(value: unknown): ResponseStreamToolCall | null {
  if (!isRecord(value) || !isRecord(value.function) || typeof value.function.name !== "string") {
    return null;
  }

  const args = value.function.arguments;

  if (typeof args !== "string" && !isRecord(args)) {
    return null;
  }

  return {
    id: typeof value.id === "string" ? value.id : undefined,
    type: "function",
    function: { name: value.function.name, arguments: args },
    index: typeof value.index === "number" ? value.index : undefined,
  };
}

function readToolCalls(value: unknown): ResponseStreamToolCall[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const toolCalls = value.flatMap((item): ResponseStreamToolCall[] => {
    const parsed = readToolCall(item);

    return parsed ? [parsed] : [];
  });

  return toolCalls.length > 0 ? toolCalls : undefined;
}

function messageText(message: ItemMessageLike): string {
  return typeof message.content === "string" ? message.content : "";
}

export function createResponseStreamAssembler(
  options: ResponseStreamAssemblerOptions = {},
): ResponseStreamAssembler {
  return new ResponseStreamAssemblerState(options);
}

class ResponseStreamAssemblerState implements ResponseStreamAssembler {
  private content = "";
  private messageData: unknown;
  private reasoning = "";
  private streamedParts: MessagePart[] = [];
  private finalParts?: MessagePart[];
  private citations?: string[] | null;
  private usage: unknown;
  private id: string;
  private created?: number;
  private logId?: string;
  private toolCalls: ResponseStreamToolCall[] = [];
  private responseProvider?: string;
  private responsePlatform?: string;
  private status?: string | null;
  private provenance?: RunProvenance;
  private readonly pendingToolCalls: Record<string, PendingToolCall> = {};
  private readonly emittedToolResponseIds = new Set<string>();
  private responseModel?: string;
  private currentAssistantFinalised = false;
  private finalMessage?: ResponseStreamMessage;
  private response?: PlatformResponse;
  private readonly createId: () => string;
  private readonly now: () => number;

  constructor(private readonly options: ResponseStreamAssemblerOptions) {
    this.createId = options.createId ?? defaultCreateId;
    this.now = options.now ?? Date.now;
    this.responseModel = options.model;
    this.id = this.createId();
  }

  ingest(event: unknown): ResponseStreamUpdate[] {
    if (!isRecord(event)) {
      return [];
    }

    if (event.type === "done") {
      return this.ingestDone();
    }

    const parsed = responseStreamEventSchema.safeParse(event);

    if (!parsed.success) {
      return [];
    }

    return this.ingestEvent(parsed.data);
  }

  getFinalMessage(): ResponseStreamMessage | undefined {
    return this.finalMessage;
  }

  getResponse(): PlatformResponse | undefined {
    return this.response;
  }

  private ingestEvent(event: ResponseStreamEvent): ResponseStreamUpdate[] {
    switch (event.type) {
      case "response.created":
      case "response.in_progress":
      case "response.waiting":
      case "response.completed":
      case "response.failed":
      case "response.cancelled":
      case "response.incomplete":
      case "response.status_changed":
        this.response = event.response;

        return [{ type: "response", response: event.response, event: event.type }];
      case "response.phase":
        return [{ type: "state", state: event.phase, event }];
      case "response.retry":
        return [{ type: "state", state: "retry", event: { retry: event.retry } }];
      case "response.activity": {
        const { type: _type, sequence_number, response_id, conversation_id, ...activity } = event;

        void _type;
        void sequence_number;
        void response_id;
        void conversation_id;

        const parsedActivity = responseActivityEventSchema.safeParse(activity);

        return parsedActivity.success ? [{ type: "activity", activity: parsedActivity.data }] : [];
      }

      case "response.agent_event":
        return [{ type: "state", state: "agent_event", event: { event: event.event } }];
      case "response.state": {
        const { type: _type, state, ...rest } = event;

        void _type;

        return [{ type: "state", state, event: rest }];
      }

      case "response.usage":
        return [{ type: "usage", usage: event.usage }];
      case "response.usage_limits":
        return [{ type: "usage_limits", usageLimits: event.usage_limits }];
      case "response.output_item.added":
        return this.ingestItemAdded(event.item);
      case "response.output_item.done":
        return this.ingestItemDone(event.item, event.finish_reason);
      case "response.content_part.done":
        return this.ingestMessageStop();
      case "response.output_text.delta":
        return this.ingestContentDelta(event.delta);
      case "response.reasoning.delta":
        return this.ingestThinkingDelta(event.delta);
      case "response.reasoning.signature":
        return [];
      case "response.tool_call.arguments.delta": {
        const pending = this.pendingToolCalls[event.call_id];

        if (pending) {
          this.appendToolUseParameters(pending, event.delta);
        }

        return [];
      }

      case "response.tool_outputs.done":
        if (this.currentAssistantFinalised) {
          this.resetAssistantState();
        }

        return [];
      case "response.error":
        return [{ type: "error", error: event.error, code: event.code }];
      case "conversation.compacted":
        return [
          {
            type: "state",
            state: "compaction",
            event: { message: itemToMessage(event.item) },
          },
        ];
      case "conversation.title_changed":
        return [{ type: "state", state: "conversation_title", event: { title: event.title } }];
    }
  }

  private ingestItemAdded(item: StoredItem | ToolCallItem): ResponseStreamUpdate[] {
    if (item.type === "tool_call") {
      this.pendingToolCalls[item.call_id] = {
        id: item.call_id,
        name: item.name ?? "unknown",
        parameterFragments: [],
        parameters: {},
      };

      return [
        { type: "tool_call_started", toolCallId: item.call_id, toolName: item.name ?? "unknown" },
      ];
    }

    if (item.type !== "message" || item.role !== "assistant") {
      return [];
    }

    if (this.currentAssistantFinalised) {
      this.resetAssistantState();
    }

    if (item.id) {
      this.id = item.id;
    }

    this.applyMessageMetadata(item.metadata);

    return [{ type: "assistant_metadata", message: this.buildAssistantMessage(this.id) }];
  }

  private ingestItemDone(
    item: StoredItem | ToolCallItem,
    finishReason: string | null | undefined,
  ): ResponseStreamUpdate[] {
    if (item.type === "tool_call") {
      return this.ingestToolCallDone(item);
    }

    if (item.type === "tool_output") {
      return this.ingestToolOutput(item);
    }

    if (item.type !== "message" || item.role !== "assistant") {
      return [];
    }

    return this.ingestAssistantDone(item, finishReason);
  }

  private ingestToolCallDone(item: ToolCallItem): ResponseStreamUpdate[] {
    const pending = this.pendingToolCalls[item.call_id];
    const input =
      item.arguments !== undefined
        ? item.arguments
        : pending
          ? this.finaliseToolUseParameters(pending)
          : {};
    const name = item.name ?? pending?.name ?? "unknown";

    this.toolCalls.push({
      id: item.call_id,
      type: "function",
      function: { name, arguments: input },
    });

    if (!this.currentAssistantFinalised) {
      this.streamedParts.push({
        type: "tool_use",
        name,
        toolCallId: item.call_id,
        input,
        timestamp: this.now(),
      });
    }

    delete this.pendingToolCalls[item.call_id];

    return [{ type: "tool_call_finished", toolCallId: item.call_id }];
  }

  private ingestToolOutput(
    item: Extract<StoredItem, { type: "tool_output" }>,
  ): ResponseStreamUpdate[] {
    const message = itemToMessage(item);
    const toolResponseId = typeof message.id === "string" ? message.id : this.createId();

    if (this.emittedToolResponseIds.has(toolResponseId)) {
      return [];
    }

    this.emittedToolResponseIds.add(toolResponseId);
    const rawArguments = message.tool_call_arguments;
    const toolCallArguments =
      typeof rawArguments === "string"
        ? rawArguments
        : isRecord(rawArguments)
          ? rawArguments
          : undefined;

    return [
      {
        type: "tool_result",
        message: {
          role: "tool",
          id: toolResponseId,
          content: messageText(message),
          name: typeof message.name === "string" ? message.name : undefined,
          status: typeof message.status === "string" ? message.status : null,
          data: message.data ?? null,
          created: this.now(),
          timestamp: typeof message.timestamp === "number" ? message.timestamp : undefined,
          log_id: typeof message.log_id === "string" ? message.log_id : undefined,
          model: typeof message.model === "string" ? message.model : undefined,
          platform: typeof message.platform === "string" ? message.platform : undefined,
          tool_call_id: typeof message.tool_call_id === "string" ? message.tool_call_id : undefined,
          tool_call_arguments: toolCallArguments,
          tool_calls: readToolCalls(message.tool_calls),
          parts: message.parts,
        },
      },
    ];
  }

  private ingestAssistantDone(
    item: MessageItem,
    finishReason: string | null | undefined,
  ): ResponseStreamUpdate[] {
    const message = itemToMessage(item);
    const content = typeof message.content === "string" ? message.content : undefined;

    if (content !== undefined) {
      this.content = content;
      this.streamedParts = this.content
        ? [{ type: "text", text: this.content, timestamp: this.now() }]
        : [];
    }

    const metadata = item.metadata ?? {};

    if ("usage" in metadata) {
      this.usage = metadata.usage;
    }

    if ("data" in metadata) {
      this.messageData = metadata.data;
    }

    const citations = readStringArrayOrNull(metadata.citations);

    if (citations !== undefined) {
      this.citations = citations;
    }

    this.applyMessageMetadata(metadata);

    if (typeof item.status === "string" || item.status === null) {
      this.status = item.status;
    }

    const nextToolCalls = readToolCalls(metadata.tool_calls);

    if (nextToolCalls) {
      this.toolCalls = nextToolCalls;
    }

    const parts = normaliseMessageParts(item.parts);

    if (parts) {
      this.finalParts = parts;
    }

    if (item.id) {
      this.id = item.id;
    }

    if (!this.hasAssistantPayload()) {
      return [];
    }

    const carriesFinalPayload =
      content !== undefined ||
      parts !== undefined ||
      nextToolCalls !== undefined ||
      finishReason === "stop";

    return carriesFinalPayload
      ? [{ type: "assistant_final", message: this.finaliseAssistantMessage(this.id) }]
      : [];
  }

  private applyMessageMetadata(metadata: Record<string, unknown> | undefined): void {
    if (!metadata) {
      return;
    }

    if (typeof metadata.created === "number") {
      this.created = metadata.created;
    }

    if (typeof metadata.log_id === "string") {
      this.logId = metadata.log_id;
    }

    if (typeof metadata.model === "string") {
      this.responseModel = metadata.model;
    }

    if (typeof metadata.provider === "string") {
      this.responseProvider = metadata.provider;
    }

    if (typeof metadata.platform === "string") {
      this.responsePlatform = metadata.platform;
    }

    const provenance = runProvenanceSchema.safeParse(metadata.provenance);

    if (provenance.success) {
      this.provenance = provenance.data;
    }
  }

  private ingestDone(): ResponseStreamUpdate[] {
    if (!this.currentAssistantFinalised && this.hasAssistantPayload()) {
      const message = this.finaliseAssistantMessage();

      return [
        { type: "assistant_final", message },
        { type: "done", message },
      ];
    }

    return [{ type: "done", message: this.finalMessage }];
  }

  private ingestContentDelta(contentDelta: string): ResponseStreamUpdate[] {
    if (this.currentAssistantFinalised) {
      this.resetAssistantState();
    }

    this.content += contentDelta;
    this.appendTextPart(contentDelta);

    return [{ type: "assistant_delta", content: this.content, reasoning: this.reasoning }];
  }

  private ingestMessageStop(): ResponseStreamUpdate[] {
    if (this.currentAssistantFinalised || !this.hasAssistantPayload()) {
      return [];
    }

    return [{ type: "assistant_final", message: this.finaliseAssistantMessage() }];
  }

  private ingestThinkingDelta(thinkingDelta: string): ResponseStreamUpdate[] {
    this.reasoning += thinkingDelta;
    this.appendReasoningPart(thinkingDelta);

    return [{ type: "assistant_delta", content: this.content, reasoning: this.reasoning }];
  }

  private resetAssistantState() {
    this.content = "";
    this.messageData = undefined;
    this.reasoning = "";
    this.streamedParts = [];
    this.finalParts = undefined;
    this.citations = undefined;
    this.usage = undefined;
    this.id = this.createId();
    this.created = undefined;
    this.logId = undefined;
    this.toolCalls = [];
    this.responseModel = this.options.model;
    this.responseProvider = undefined;
    this.responsePlatform = undefined;
    this.status = undefined;
    this.provenance = undefined;
    this.currentAssistantFinalised = false;
  }

  private buildAssistantMessage(messageId?: string): ResponseStreamMessage {
    return {
      role: "assistant",
      content: this.content,
      parts:
        this.finalParts && this.finalParts.length > 0
          ? this.finalParts
          : this.streamedParts.length > 0
            ? this.streamedParts
            : undefined,
      data: this.messageData,
      reasoning: this.reasoning ? { collapsed: false, content: this.reasoning } : undefined,
      id: messageId || this.id,
      created: this.created,
      timestamp: this.created,
      model: this.responseModel,
      provider: this.responseProvider,
      platform: this.responsePlatform,
      citations: this.citations ?? null,
      usage: this.usage,
      tool_calls: this.toolCalls.length > 0 ? this.toolCalls : undefined,
      log_id: this.logId,
      status: this.status,
      provenance: this.provenance,
    };
  }

  private hasAssistantPayload(): boolean {
    return Boolean(
      this.content ||
      this.reasoning ||
      (this.finalParts && this.finalParts.length > 0) ||
      this.streamedParts.length > 0 ||
      this.toolCalls.length > 0,
    );
  }

  private finaliseAssistantMessage(messageId?: string): ResponseStreamMessage {
    const message = this.buildAssistantMessage(messageId);

    this.finalMessage = message;
    this.currentAssistantFinalised = true;

    return message;
  }

  private appendTextPart(text: string) {
    if (!text) {
      return;
    }

    const lastPart = this.streamedParts[this.streamedParts.length - 1];

    if (lastPart?.type === "text") {
      lastPart.text += text;

      return;
    }

    this.streamedParts.push({ type: "text", text, timestamp: this.now() });
  }

  private appendReasoningPart(text: string) {
    if (!text) {
      return;
    }

    const lastPart = this.streamedParts[this.streamedParts.length - 1];

    if (lastPart?.type === "reasoning") {
      lastPart.text += text;

      return;
    }

    this.streamedParts.push({ type: "reasoning", text, collapsed: true, timestamp: this.now() });
  }

  private appendToolUseParameters(pending: PendingToolCall, parameters: unknown): void {
    if (isRecord(parameters)) {
      pending.parameters = { ...pending.parameters, ...parameters };

      return;
    }

    if (typeof parameters === "string") {
      pending.parameterFragments.push(parameters);
    }
  }

  private finaliseToolUseParameters(pending: PendingToolCall): string | Record<string, unknown> {
    if (pending.parameterFragments.length === 0) {
      return pending.parameters;
    }

    const rawParameters = pending.parameterFragments.join("");

    try {
      const parsed: unknown = JSON.parse(rawParameters);

      return isRecord(parsed) ? { ...pending.parameters, ...parsed } : rawParameters;
    } catch {
      return rawParameters;
    }
  }
}

export interface ResponseEventStamperOptions {
  responseId?: string;
  conversationId?: string;
}

export interface ResponseEventStamper {
  stamp(event: ResponseEventInput): ResponseStreamEvent;
  readonly sequence: number;
}

interface ResponseEventParser {
  parse(value: unknown): ResponseStreamEvent;
}

const EVENT_PARSERS = new Map<string, ResponseEventParser>();

for (const option of responseStreamEventSchema.options) {
  const type = option.shape.type.value;

  EVENT_PARSERS.set(type, EVENT_PARSERS.has(type) ? responseStreamEventSchema : option);
}

function lifecycleResponse(event: ResponseEventInput): PlatformResponse | undefined {
  switch (event.type) {
    case "response.created":
    case "response.in_progress":
    case "response.waiting":
    case "response.completed":
    case "response.failed":
    case "response.cancelled":
    case "response.incomplete":
    case "response.status_changed":
      return event.response;
    default:
      return undefined;
  }
}

const INDEXED_EVENT_TYPES = new Set([
  "response.output_item.added",
  "response.output_item.done",
  "response.output_text.delta",
  "response.reasoning.delta",
]);

function outputItemKey(event: ResponseEventInput): string | undefined {
  switch (event.type) {
    case "response.output_item.added":
    case "response.output_item.done":
      return event.item.type === "tool_call" ? event.item.call_id : event.item.id;
    case "response.output_text.delta":
    case "response.reasoning.delta":
      return event.item_id;
    default:
      return undefined;
  }
}

export function createResponseEventStamper(
  options: ResponseEventStamperOptions = {},
): ResponseEventStamper {
  let sequence = 0;
  let nextOutputIndex = 0;
  let responseId = options.responseId;
  let createdEmitted = false;
  const outputIndexes = new Map<string, number>();

  const outputIndexFor = (event: ResponseEventInput): number | undefined => {
    if (!INDEXED_EVENT_TYPES.has(event.type)) {
      return undefined;
    }

    const key = outputItemKey(event);
    const known = key === undefined ? undefined : outputIndexes.get(key);

    if (known !== undefined) {
      return known;
    }

    const index = nextOutputIndex++;

    if (key !== undefined) {
      outputIndexes.set(key, index);
    }

    return index;
  };

  const stamp = (event: ResponseEventInput): ResponseStreamEvent => {
    let type: string = event.type;
    const response = lifecycleResponse(event);

    if (response) {
      responseId = response.id;

      if (!createdEmitted) {
        createdEmitted = true;
        type = "response.created";
      }
    }

    const outputIndex = outputIndexFor(event);
    const parser = EVENT_PARSERS.get(type);

    if (!parser) {
      throw new Error(`Unknown response stream event ${type}`);
    }

    return parser.parse({
      ...event,
      type,
      ...(outputIndex === undefined ? {} : { output_index: outputIndex }),
      sequence_number: sequence++,
      ...(responseId ? { response_id: responseId } : {}),
      ...(options.conversationId ? { conversation_id: options.conversationId } : {}),
    });
  };

  return {
    stamp,
    get sequence() {
      return sequence;
    },
  };
}

export function responseLifecycleEvent(response: PlatformResponse): ResponseEventInput {
  switch (response.status) {
    case "in_progress":
      return { type: "response.in_progress", response };
    case "awaiting_approval":
    case "awaiting_input":
    case "awaiting_takeover":
      return { type: "response.waiting", response };
    case "completed":
      return { type: "response.completed", response };
    case "failed":
      return { type: "response.failed", response };
    case "cancelled":
      return { type: "response.cancelled", response };
    case "incomplete":
      return { type: "response.incomplete", response };
    default:
      return { type: "response.status_changed", response };
  }
}

export function responseReceiptEvent(receipt: ChatRunCommandReceipt): ResponseEventInput {
  return responseLifecycleEvent(toResponse(receipt.run, { receipt }));
}

export function assistantMessageAddedEvent(
  id: string,
  metadata: Record<string, unknown> = {},
): ResponseEventInput {
  return {
    type: "response.output_item.added",
    item: {
      type: "message",
      role: "assistant",
      id,
      content: [],
      status: "in_progress",
      ...(Object.keys(metadata).length > 0 ? { metadata } : {}),
    },
  };
}

export function assistantMessageDoneEvent(
  message: Omit<ItemMessageLike, "role"> & { id: string } & Record<string, unknown>,
  finishReason: string | null = null,
): ResponseEventInput {
  return {
    type: "response.output_item.done",
    item: messageToItem({ ...message, role: "assistant" }),
    finish_reason: finishReason,
  };
}

function parseToolArguments(
  raw: string | Record<string, unknown>,
): string | Record<string, unknown> {
  if (typeof raw !== "string") {
    return raw;
  }

  try {
    const parsed: unknown = JSON.parse(raw);

    return isRecord(parsed) ? parsed : raw;
  } catch {
    return raw;
  }
}

export function toolCallAddedEvent(callId: string, name: string): ResponseEventInput {
  return {
    type: "response.output_item.added",
    item: { type: "tool_call", call_id: callId, id: callId, name },
  };
}

export function toolCallDoneEvent(
  callId: string,
  name: string,
  rawArguments?: string | Record<string, unknown>,
): ResponseEventInput {
  return {
    type: "response.output_item.done",
    item: {
      type: "tool_call",
      call_id: callId,
      id: callId,
      name,
      ...(rawArguments === undefined || rawArguments === ""
        ? {}
        : { arguments: parseToolArguments(rawArguments) }),
    },
  };
}

export function toolOutputEvent(result: Omit<ItemMessageLike, "role">): ResponseEventInput {
  return { type: "response.output_item.done", item: messageToItem({ ...result, role: "tool" }) };
}

export function conversationCompactedEvent(
  message: Omit<ItemMessageLike, "role">,
): ResponseEventInput {
  return {
    type: "conversation.compacted",
    item: messageToItem({ ...message, role: "compaction" }),
  };
}
