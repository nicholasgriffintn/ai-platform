import type { Message } from "~/types";
import { hasCompactionPart, isCompactionMarkerMessage } from "~/lib/chat/messageParts";
import {
	estimateConversationTokens,
	estimateMessageTokens,
	messageToText,
	type MessageTokenInput,
} from "~/lib/messageTokens";

export interface CompactionWindowConfig {
	contextWindow?: number;
	mode?: CompactionMode;
	triggerRatio?: number;
	keepRecentMessages?: number;
}

export type CompactionMode = "auto" | "manual" | "off";

export type CompactionPlanMessage = MessageTokenInput;

export interface CompactionPlan<TMessage extends CompactionPlanMessage = Message> {
	shouldCompact: boolean;
	messagesToArchive: TMessage[];
	messagesToKeep: TMessage[];
	snapshotInsertionIndex: number;
}

const DEFAULT_CONTEXT_WINDOW = 32000;
const DEFAULT_TRIGGER_RATIO = 0.7;
const DEFAULT_KEEP_RECENT_MESSAGES = 8;
export { estimateConversationTokens, estimateMessageTokens };

function countsTowardCompactionPressure(message: CompactionPlanMessage): boolean {
	return !isCompactionMarkerMessage(message) && !hasCompactionPart(message);
}

function canArchiveDuringCompaction(message: CompactionPlanMessage): boolean {
	if (message.role === "system" || message.role === "developer") {
		return false;
	}

	if (!countsTowardCompactionPressure(message)) {
		return false;
	}

	return true;
}

export function buildCompactionPlan<TMessage extends CompactionPlanMessage>(
	messages: TMessage[],
	config: CompactionWindowConfig = {},
): CompactionPlan<TMessage> {
	const mode = config.mode ?? "auto";
	const contextWindow = config.contextWindow ?? DEFAULT_CONTEXT_WINDOW;
	const triggerRatio = config.triggerRatio ?? DEFAULT_TRIGGER_RATIO;
	const keepRecentMessages = config.keepRecentMessages ?? DEFAULT_KEEP_RECENT_MESSAGES;

	if (mode === "off") {
		return {
			shouldCompact: false,
			messagesToArchive: [],
			messagesToKeep: messages,
			snapshotInsertionIndex: messages.length,
		};
	}

	if (mode === "auto") {
		const estimatedTokens = estimateConversationTokens(
			messages.filter(countsTowardCompactionPressure),
		);
		const compactionThreshold = Math.floor(contextWindow * triggerRatio);
		if (estimatedTokens < compactionThreshold) {
			return {
				shouldCompact: false,
				messagesToArchive: [],
				messagesToKeep: messages,
				snapshotInsertionIndex: messages.length,
			};
		}
	}

	if (mode !== "auto" && mode !== "manual") {
		return {
			shouldCompact: false,
			messagesToArchive: [],
			messagesToKeep: messages,
			snapshotInsertionIndex: messages.length,
		};
	}

	const archiveBoundary =
		mode === "manual"
			? messages.length
			: messages.length > keepRecentMessages
				? messages.length - keepRecentMessages
				: Math.max(messages.length - 1, 0);
	const archiveableHead = messages.slice(0, archiveBoundary);
	const tail = messages.slice(archiveBoundary);

	const messagesToArchive = archiveableHead.filter(canArchiveDuringCompaction);
	if (messagesToArchive.length === 0) {
		return {
			shouldCompact: false,
			messagesToArchive: [],
			messagesToKeep: messages,
			snapshotInsertionIndex: messages.length,
		};
	}

	const preservedHead = archiveableHead.filter((message) => !canArchiveDuringCompaction(message));
	const messagesToKeep = [...preservedHead, ...tail];

	return {
		shouldCompact: true,
		messagesToArchive,
		messagesToKeep,
		snapshotInsertionIndex: preservedHead.length,
	};
}

const ROLE_LABELS: Partial<Record<Message["role"], string>> = {
	user: "[User]",
	assistant: "[Assistant]",
	tool: "[Tool result]",
	system: "[System]",
	developer: "[Developer]",
};

export function buildFallbackSummary(messages: Message[]): string {
	const lines = messages.slice(-6).flatMap((message) => {
		const label = ROLE_LABELS[message.role] ?? `[${message.role}]`;
		const text = messageToText(message);
		return text ? [`${label} ${text}`.trim()] : [];
	});

	if (lines.length === 0) {
		return "Conversation snapshot recorded.";
	}

	return `Earlier context summary:\n${lines.join("\n")}`;
}

export function formatMessagesForSummary(messages: Message[], maxCharacters = 16000): string {
	const lines: string[] = [];
	let remaining = maxCharacters;

	for (const message of messages) {
		const label = ROLE_LABELS[message.role] ?? `[${message.role}]`;
		const body = messageToText(message);
		if (!body) {
			continue;
		}

		const prefix = message.role === "tool" && message.name ? `${label}(${message.name})` : label;
		const line = `${prefix}: ${body}`;

		if (line.length > remaining) {
			if (remaining <= 0) {
				break;
			}
			lines.push(`${line.slice(0, remaining)}…`);
			break;
		}

		lines.push(line);
		remaining -= line.length;
	}

	return lines.join("\n");
}
