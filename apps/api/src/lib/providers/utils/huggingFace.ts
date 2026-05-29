import type { ChatCompletionParameters, ModelConfigItem } from "~/types";
import type { FetchAIResponseOptions } from "~/lib/providers/lib/fetch";
import { buildInputSchemaInput } from "~/utils/inputSchema";
import { AssistantError, ErrorType } from "~/utils/errors";
import { isRecord, omitUndefinedValues } from "~/utils/objects";
import { readOptionBag, readRecordOption } from "~/utils/options";

export type HuggingFaceLoadingError = {
	body: Record<string, any>;
	message: string;
	estimatedTimeSeconds?: number;
};

const DEFAULT_HUGGINGFACE_RETRY_ATTEMPTS = 3;
const DEFAULT_HUGGINGFACE_RETRY_DELAY_MS = 1000;
const DEFAULT_LOADING_POLL_INTERVAL_MS = 30000;
const MAX_LOADING_POLL_INTERVAL_MS = 120000;
const MIN_LOADING_POLL_INTERVAL_MS = 6000;
const PROTECTED_EXTRA_BODY_KEYS = new Set(["model", "messages", "stream"]);

function readFiniteNumber(value: unknown): number | undefined {
	return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function readIntegerOption(value: unknown, fallback: number, min: number, max: number): number {
	const numberValue = readFiniteNumber(value);
	if (numberValue === undefined) {
		return fallback;
	}

	return Math.min(max, Math.max(min, Math.floor(numberValue)));
}

function readBackoffOption(value: unknown): "exponential" | "linear" {
	return value === "linear" ? "linear" : "exponential";
}

function getErrorMessageFromBody(body: Record<string, any>): string | undefined {
	if (typeof body.error === "string") {
		return body.error;
	}

	if (isRecord(body.error)) {
		if (typeof body.error.error === "string") {
			return body.error.error;
		}
		if (typeof body.error.message === "string") {
			return body.error.message;
		}
	}

	if (typeof body.message === "string") {
		return body.message;
	}

	return undefined;
}

function getEstimatedTimeSeconds(body: Record<string, any>): number | undefined {
	const direct = readFiniteNumber(body.estimated_time);
	if (direct !== undefined) {
		return direct;
	}

	if (isRecord(body.error)) {
		return readFiniteNumber(body.error.estimated_time);
	}

	return undefined;
}

function getExplicitExtraBody(params: ChatCompletionParameters): Record<string, any> {
	const body = readOptionBag(params.body);
	const options = readOptionBag(params.options);
	const huggingfaceOptions = readRecordOption(options, "huggingface");

	return {
		...readRecordOption(body, "extra_body"),
		...readRecordOption(huggingfaceOptions, "extra_body"),
	};
}

function sanitizeExtraBody(extraBody: Record<string, any>): Record<string, any> {
	for (const key of Object.keys(extraBody)) {
		if (PROTECTED_EXTRA_BODY_KEYS.has(key)) {
			throw new AssistantError(
				`Hugging Face extra_body cannot override "${key}".`,
				ErrorType.PARAMS_ERROR,
			);
		}
	}

	return omitUndefinedValues(extraBody);
}

export function getHuggingFaceFetchOptions(
	params: ChatCompletionParameters,
	modelConfig: ModelConfigItem,
): FetchAIResponseOptions {
	const options = readOptionBag(params.options);
	const huggingfaceOptions = readRecordOption(options, "huggingface");

	return {
		requestTimeout: modelConfig.timeout || 100000,
		maxAttempts: readIntegerOption(
			huggingfaceOptions.maxAttempts,
			DEFAULT_HUGGINGFACE_RETRY_ATTEMPTS,
			1,
			5,
		),
		retryDelay: readIntegerOption(
			huggingfaceOptions.retryDelayMs,
			DEFAULT_HUGGINGFACE_RETRY_DELAY_MS,
			0,
			30000,
		),
		backoff: readBackoffOption(huggingfaceOptions.backoff),
	};
}

export function buildHuggingFaceExtraBody(
	params: ChatCompletionParameters,
	modelConfig: ModelConfigItem,
): Record<string, any> {
	const schemaExtraBody = modelConfig.inputSchema?.fields?.length
		? buildInputSchemaInput(params, modelConfig).input
		: {};

	return sanitizeExtraBody({
		...(isRecord(schemaExtraBody) ? schemaExtraBody : {}),
		...getExplicitExtraBody(params),
	});
}

export function getHuggingFaceLoadingError(error: unknown): HuggingFaceLoadingError | undefined {
	if (!(error instanceof AssistantError) || !isRecord(error.context?.responseJson)) {
		return undefined;
	}

	const body = error.context.responseJson as Record<string, any>;
	const message = getErrorMessageFromBody(body);
	if (!message?.toLowerCase().includes("currently loading")) {
		return undefined;
	}

	return {
		body,
		message,
		estimatedTimeSeconds: getEstimatedTimeSeconds(body),
	};
}

export function getHuggingFaceLoadingPollIntervalMs(estimatedTimeSeconds?: number): number {
	if (estimatedTimeSeconds === undefined) {
		return DEFAULT_LOADING_POLL_INTERVAL_MS;
	}

	return Math.min(
		MAX_LOADING_POLL_INTERVAL_MS,
		Math.max(MIN_LOADING_POLL_INTERVAL_MS, Math.ceil(estimatedTimeSeconds * 1000)),
	);
}
