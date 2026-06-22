import type { ConversationModeMetadata } from "@assistant/schemas";

import { getMessageTextContent, normalizeMessage } from "~/lib/messages";
import type { Message } from "~/types";
import type { RealtimeTranscriptResult } from "./messages";

interface ActiveLiveMessage {
	message: Message;
	text: string;
}

export interface LiveTurn {
	id: string;
	inputFinal: boolean;
	inputStarted: boolean;
	inputTextPresent: boolean;
	outputFinal: boolean;
	outputStarted: boolean;
	startedAt: number;
}

interface LiveRealtimeMetadata {
	sequence: number;
	source: RealtimeTranscriptResult["source"];
	turnId: string;
	turnStartedAt: number;
}

interface LiveMessageOrder {
	sequence: number;
	startedAt: number;
	turnId: string;
}

export const DEFAULT_LIVE_CONVERSATION_TITLES = new Set(["New Conversation", "New conversation"]);

export function createLiveTurn(now = Date.now()): LiveTurn {
	return {
		id: crypto.randomUUID(),
		inputFinal: false,
		inputStarted: false,
		inputTextPresent: false,
		outputFinal: false,
		outputStarted: false,
		startedAt: now,
	};
}

export function createTemporaryLiveTitle(message: Message): string {
	const text = getMessageTextContent(message).replace(/\s+/g, " ").trim();
	if (!text) {
		return "New Conversation";
	}

	return `${text.slice(0, 30)}${text.length > 30 ? "..." : ""}`;
}

export function getMessageRecordData(message: Message): Record<string, unknown> {
	if (!message.data || typeof message.data !== "object") {
		return {};
	}

	return Object.fromEntries(Object.entries(message.data));
}

function isLiveRealtimeMetadata(value: unknown): value is LiveRealtimeMetadata {
	if (typeof value !== "object" || value === null) {
		return false;
	}

	if (!("turnId" in value) || !("sequence" in value) || !("turnStartedAt" in value)) {
		return false;
	}

	return (
		typeof value.turnId === "string" &&
		typeof value.sequence === "number" &&
		typeof value.turnStartedAt === "number"
	);
}

export function getLiveMessageOrder(message: Message): LiveMessageOrder | undefined {
	const realtime = getMessageRecordData(message).realtime;
	if (!isLiveRealtimeMetadata(realtime)) {
		return undefined;
	}

	return {
		sequence: realtime.sequence,
		startedAt: realtime.turnStartedAt,
		turnId: realtime.turnId,
	};
}

export function orderLiveMessages(messages: Message[]): Message[] {
	const originalIndex = new Map(messages.map((message, index) => [message.id, index]));

	return [...messages].sort((left, right) => {
		const leftOrder = getLiveMessageOrder(left);
		const rightOrder = getLiveMessageOrder(right);

		if (leftOrder && rightOrder) {
			if (leftOrder.startedAt !== rightOrder.startedAt) {
				return leftOrder.startedAt - rightOrder.startedAt;
			}
			if (leftOrder.turnId === rightOrder.turnId) {
				return leftOrder.sequence - rightOrder.sequence;
			}
			return (originalIndex.get(left.id) ?? 0) - (originalIndex.get(right.id) ?? 0);
		}

		if (leftOrder || rightOrder) {
			const leftStartedAt = leftOrder?.startedAt ?? left.timestamp ?? left.created ?? 0;
			const rightStartedAt = rightOrder?.startedAt ?? right.timestamp ?? right.created ?? 0;
			if (leftStartedAt !== rightStartedAt) {
				return leftStartedAt - rightStartedAt;
			}

			const leftSequence = leftOrder?.sequence ?? (left.role === "user" ? 0 : 1);
			const rightSequence = rightOrder?.sequence ?? (right.role === "user" ? 0 : 1);
			if (leftSequence !== rightSequence) {
				return leftSequence - rightSequence;
			}
		}

		return (originalIndex.get(left.id) ?? 0) - (originalIndex.get(right.id) ?? 0);
	});
}

export function buildLiveMessage({
	activeMessage,
	content,
	conversationMode,
	isFinal,
	model,
	role,
	source,
	turn,
}: {
	activeMessage?: ActiveLiveMessage | null;
	content: string;
	conversationMode?: ConversationModeMetadata;
	isFinal: boolean;
	model?: string | null;
	role: "user" | "assistant";
	source: RealtimeTranscriptResult["source"];
	turn: LiveTurn;
}): Message {
	const now = Date.now();
	const existingData = activeMessage ? getMessageRecordData(activeMessage.message) : {};

	return normalizeMessage({
		...activeMessage?.message,
		content,
		created: activeMessage?.message.created ?? now,
		data: {
			...existingData,
			...(conversationMode ? { conversationMode } : {}),
			realtime: {
				source,
				turnId: turn.id,
				turnStartedAt: turn.startedAt,
				sequence: role === "user" ? 0 : 1,
			},
		},
		id: activeMessage?.message.id ?? crypto.randomUUID(),
		model: activeMessage?.message.model || model || undefined,
		role,
		status: isFinal ? undefined : "in_progress",
		timestamp: activeMessage?.message.timestamp ?? now,
	});
}
