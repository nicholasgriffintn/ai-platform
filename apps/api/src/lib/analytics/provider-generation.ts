import type { ExecutionContext } from "@cloudflare/workers-types";

import { StreamingFormatter } from "~/lib/formatter";
import type { ChatCompletionParameters, Message } from "~/types";
import { isRecord } from "~/utils/objects";
import { parseSseBuffer } from "~/utils/streaming";

import type { BackendAiGenerationCaptureInput, BackendAnalyticsEnv } from "./types";

export type ProviderGenerationContext = {
	provider: string;
	model: string;
	traceId: string;
	request?: ChatCompletionParameters;
	startTime: number;
};

type CaptureAiGeneration = (
	input: BackendAiGenerationCaptureInput & {
		env: BackendAnalyticsEnv;
		executionCtx?: ExecutionContext;
	},
) => void;

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
	const usage = isRecord(response.usage)
		? response.usage
		: isRecord(response.usageMetadata)
			? response.usageMetadata
			: undefined;

	captureProviderGeneration(context, capture, content, usage, false);
	return result;
}

function captureProviderGeneration(
	context: ProviderGenerationContext,
	capture: CaptureAiGeneration,
	output?: Message["content"],
	usage?: Record<string, unknown>,
	stream = false,
): void {
	const request = context.request;
	if (!request?.messages?.length) {
		return;
	}

	capture({
		env: request.env,
		user: request.context?.user,
		executionCtx: request.executionCtx,
		userTrackingEnabled: request.analyticsTrackingEnabled,
		traceId: context.traceId,
		model: context.model,
		provider: request.provider || context.provider,
		input: request.messages,
		output: output === undefined ? undefined : { role: "assistant", content: output },
		usage,
		latencyMs: performance.now() - context.startTime,
		stream,
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
	let usage: Record<string, unknown> | undefined;
	let buffer = "";

	return stream.pipeThrough(
		new TransformStream({
			transform(chunk, controller) {
				buffer += decoder.decode(chunk, { stream: true });
				buffer = parseSseBuffer(buffer, {
					onEvent(event) {
						const content = StreamingFormatter.extractContentFromChunk(event);
						if (content) {
							contentChunks.push(content);
						}

						const extractedUsage = StreamingFormatter.extractUsageData(event);
						if (isRecord(extractedUsage)) {
							usage = extractedUsage;
						}
					},
					onError: onParseError,
				});

				controller.enqueue(chunk);
			},
			flush() {
				const remainder = decoder.decode();
				if (remainder) {
					buffer += remainder;
				}

				captureProviderGeneration(
					context,
					capture,
					contentChunks.length ? contentChunks.join("") : undefined,
					usage,
					true,
				);
			},
		}),
	);
}
