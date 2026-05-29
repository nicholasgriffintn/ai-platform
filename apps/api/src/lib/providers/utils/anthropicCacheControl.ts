import { isRecord } from "~/utils/objects";

export const ANTHROPIC_MAX_CACHE_CONTROL_BLOCKS = 4;

interface CacheControlState {
	candidates: Record<string, unknown>[];
}

function cloneBlock(value: unknown): unknown {
	return isRecord(value) ? { ...value } : value;
}

function cloneMessage(value: unknown): unknown {
	if (!isRecord(value)) {
		return value;
	}

	const content = value.content;
	return {
		...value,
		...(Array.isArray(content) ? { content: content.map(cloneBlock) } : {}),
	};
}

function collectCacheControlBlocks(
	value: unknown,
	state: CacheControlState,
	direction: "forward" | "reverse" = "forward",
) {
	if (!Array.isArray(value)) {
		return;
	}

	const entries = direction === "reverse" ? [...value].reverse() : value;
	for (const entry of entries) {
		if (isRecord(entry) && "cache_control" in entry) {
			state.candidates.push(entry);
		}
	}
}

function collectMessageCacheControlBlocks(value: unknown, state: CacheControlState) {
	if (!Array.isArray(value)) {
		return;
	}

	for (const message of [...value].reverse()) {
		if (isRecord(message)) {
			collectCacheControlBlocks(message.content, state, "reverse");
		}
	}
}

export function limitAnthropicCacheControlBlocks<T extends Record<string, unknown>>(
	payload: T,
	maxBlocks = ANTHROPIC_MAX_CACHE_CONTROL_BLOCKS,
): T {
	const result: Record<string, unknown> = {
		...payload,
		...(Array.isArray(payload.system) ? { system: payload.system.map(cloneBlock) } : {}),
		...(Array.isArray(payload.tools) ? { tools: payload.tools.map(cloneBlock) } : {}),
		...(Array.isArray(payload.messages) ? { messages: payload.messages.map(cloneMessage) } : {}),
	};

	const state: CacheControlState = { candidates: [] };
	collectCacheControlBlocks(result.system, state);
	collectCacheControlBlocks(result.tools, state);
	collectMessageCacheControlBlocks(result.messages, state);

	for (const block of state.candidates.slice(Math.max(maxBlocks, 0))) {
		delete block.cache_control;
	}

	return result as T;
}
