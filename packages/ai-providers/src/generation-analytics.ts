import type { ExecutionContext } from "@cloudflare/workers-types";
import {
  extractUsagePayload,
  mergeStreamedTokenUsage,
  type AiErrorInfo,
  type AiGenerationSignal,
  type TelemetryEnv,
  type TelemetryProperties,
} from "@ngriffin_uk/polychat-ai-telemetry";
import { isRecord } from "@ngriffin_uk/polychat-utility-core";
import { getErrorMessage } from "@ngriffin_uk/polychat-utility-server/errors";
import { readNumberField } from "@ngriffin_uk/polychat-utility-server/record-fields";
import { parseSseBuffer } from "@ngriffin_uk/polychat-utility-server/streaming";

import { StreamingFormatter } from "./formatter/streaming.js";
import type { ChatCompletionParameters, Message } from "./types/index.js";
import {
  collectAvailableToolNames,
  collectCalledToolNames,
  readErrorStatus,
  readStopReason,
  readToolName,
} from "./utils/generation-signals.js";

export interface ProviderGenerationContext {
  provider: string;
  model: string;
  traceId: string;
  spanId?: string;
  sessionId?: string;
  spanName?: string;
  request?: ChatCompletionParameters;
  startTime: number;
}

export type CaptureAiGeneration = (
  input: AiGenerationSignal & {
    env?: TelemetryEnv;
    executionCtx?: ExecutionContext;
  },
) => void;

type GenerationOutcome = {
  output?: Message["content"];
  usage?: Record<string, unknown>;
  stream?: boolean;
  toolsCalled?: string[];
  stopReason?: string;
  timeToFirstTokenMs?: number;
  httpStatus?: number;
  error?: AiErrorInfo;
};

function baseSignal(
  context: ProviderGenerationContext,
): Omit<AiGenerationSignal, "env" | "executionCtx"> {
  const request = context.request;

  return {
    user: request?.context?.user,
    anonymousUser: request?.context?.anonymousUser,
    userTrackingEnabled: request?.analyticsTrackingEnabled,
    traceId: context.traceId,
    spanId: context.spanId,
    sessionId: context.sessionId,
    spanName: context.spanName,
    model: context.model,
    provider: request?.provider || context.provider,
    input: request?.messages,
    tools: collectAvailableToolNames(request),
    temperature: readNumberField(request, "temperature"),
    maxTokens: readNumberField(request, "max_tokens"),
    properties: experimentProperties(request?.context?.experimentAssignments),
  };
}

function experimentProperties(
  assignments: Readonly<Record<string, string>> | undefined,
): TelemetryProperties | undefined {
  const entries = Object.entries(assignments ?? {});

  return entries.length > 0
    ? Object.fromEntries(entries.map(([key, variant]) => [`experiment.${key}`, variant]))
    : undefined;
}

function captureProviderGeneration(
  context: ProviderGenerationContext,
  capture: CaptureAiGeneration,
  outcome: GenerationOutcome,
): void {
  capture({
    ...baseSignal(context),
    executionCtx: context.request?.executionCtx,
    env: context.request?.env,
    output:
      outcome.output === undefined ? undefined : { role: "assistant", content: outcome.output },
    usage: outcome.usage,
    latencyMs: performance.now() - context.startTime,
    timeToFirstTokenMs: outcome.timeToFirstTokenMs,
    stream: outcome.stream ?? false,
    stopReason: outcome.stopReason,
    toolsCalled: outcome.toolsCalled,
    httpStatus: outcome.httpStatus,
    error: outcome.error,
  });
}

function readStreamToolNames(event: Record<string, unknown>): string[] {
  const currentEventType = typeof event.type === "string" ? event.type : "";
  const extracted = StreamingFormatter.extractToolCall(event, currentEventType);

  if (!extracted) {
    return [];
  }

  if (Array.isArray(extracted.toolCalls)) {
    return extracted.toolCalls.flatMap((toolCall: unknown) => {
      const name = readToolName(toolCall);

      return name ? [name] : [];
    });
  }

  const name = readToolName(extracted);

  return name ? [name] : [];
}

export function captureProviderGenerationResult<T>(
  result: T,
  context: ProviderGenerationContext,
  capture: CaptureAiGeneration,
  onParseError: (error: Error) => void,
): T {
  if (!context.request?.messages?.length) {
    return result;
  }

  if (result instanceof ReadableStream) {
    return observeProviderStream(result, context, capture, onParseError) as T;
  }

  const response: Record<string, unknown> = isRecord(result) ? result : {};
  const content = response.response as Message["content"] | undefined;
  const usage = extractUsagePayload(response) ?? undefined;

  captureProviderGeneration(context, capture, {
    output: content,
    usage,
    toolsCalled: collectCalledToolNames(response),
    stopReason: readStopReason(response),
  });

  return result;
}

export function captureProviderGenerationFailure(
  error: unknown,
  context: ProviderGenerationContext,
  capture: CaptureAiGeneration,
): void {
  captureProviderGeneration(context, capture, {
    stream: context.request?.stream === true,
    error: {
      message: getErrorMessage(error),
      httpStatus: readErrorStatus(error),
    },
  });
}

function observeProviderStream(
  stream: ReadableStream,
  context: ProviderGenerationContext,
  capture: CaptureAiGeneration,
  onParseError: (error: Error) => void,
): ReadableStream {
  const decoder = new TextDecoder();
  const contentChunks: string[] = [];
  const toolsCalled = new Set<string>();
  let usage: Record<string, unknown> | undefined;
  let stopReason: string | undefined;
  let firstContentAt: number | undefined;
  let buffer = "";

  const handleEvent = (event: Record<string, unknown>) => {
    const content = StreamingFormatter.extractContentFromChunk(event);

    if (content) {
      contentChunks.push(content);
      firstContentAt ??= performance.now();
    }

    for (const name of readStreamToolNames(event)) {
      toolsCalled.add(name);
    }

    stopReason = readStopReason(event) ?? stopReason;

    const extractedUsage = StreamingFormatter.extractUsageData(event);

    if (isRecord(extractedUsage)) {
      usage = mergeStreamedTokenUsage(usage, extractedUsage) ?? usage;
    }
  };

  return stream.pipeThrough(
    new TransformStream({
      transform(chunk, controller) {
        buffer += decoder.decode(chunk, { stream: true });
        buffer = parseSseBuffer(buffer, {
          onEvent: handleEvent,
          onError: onParseError,
        });

        controller.enqueue(chunk);
      },
      flush() {
        const remainder = decoder.decode();

        if (remainder) {
          buffer += remainder;
        }

        if (buffer.trim()) {
          parseSseBuffer(`${buffer}\n\n`, {
            onEvent: handleEvent,
            onError: onParseError,
          });
        }

        const timeToFirstTokenMs =
          firstContentAt === undefined ? undefined : firstContentAt - context.startTime;

        captureProviderGeneration(context, capture, {
          output: contentChunks.length ? contentChunks.join("") : undefined,
          usage,
          stream: true,
          toolsCalled: toolsCalled.size > 0 ? [...toolsCalled] : undefined,
          stopReason,
          timeToFirstTokenMs,
        });
      },
    }),
  );
}
