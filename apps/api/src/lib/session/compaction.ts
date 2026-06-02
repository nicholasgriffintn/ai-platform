import type { Message } from "~/types";
import {
	messageContentToText,
	estimateConversationTokens,
	estimateMessageTokens,
} from "~/lib/messageTokens";

export interface CompactionWindowConfig {
	contextWindow?: number;
	triggerRatio?: number;
	minMessages?: number;
	keepRecentMessages?: number;
	minArchiveCount?: number;
}

export interface CompactionPlan {
	shouldCompact: boolean;
	messagesToArchive: Message[];
	messagesToKeep: Message[];
	snapshotInsertionIndex: number;
}

const DEFAULT_CONTEXT_WINDOW = 32000;
const DEFAULT_TRIGGER_RATIO = 0.7;
const DEFAULT_MIN_MESSAGES = 24;
const DEFAULT_KEEP_RECENT_MESSAGES = 8;
const DEFAULT_MIN_ARCHIVE_COUNT = 6;
export { estimateConversationTokens, estimateMessageTokens };

function hasSnapshotPart(message: Message): boolean {
	return Array.isArray(message.parts) && message.parts.some((part) => part.type === "snapshot");
}

function isCompactionCandidate(message: Message): boolean {
	if (message.role === "system") {
		return false;
	}

	if (hasSnapshotPart(message)) {
		return false;
	}

	return true;
}

export function buildCompactionPlan(
	messages: Message[],
	latestUserMessage: string,
	config: CompactionWindowConfig = {},
): CompactionPlan {
	const contextWindow = config.contextWindow || DEFAULT_CONTEXT_WINDOW;
	const triggerRatio = config.triggerRatio || DEFAULT_TRIGGER_RATIO;
	const minMessages = config.minMessages || DEFAULT_MIN_MESSAGES;
	const keepRecentMessages = config.keepRecentMessages || DEFAULT_KEEP_RECENT_MESSAGES;
	const minArchiveCount = config.minArchiveCount || DEFAULT_MIN_ARCHIVE_COUNT;

	if (messages.length < minMessages) {
		return {
			shouldCompact: false,
			messagesToArchive: [],
			messagesToKeep: messages,
			snapshotInsertionIndex: messages.length,
		};
	}

	const estimatedTokens = estimateConversationTokens(messages, latestUserMessage);
	const compactionThreshold = Math.floor(contextWindow * triggerRatio);
	if (estimatedTokens < compactionThreshold) {
		return {
			shouldCompact: false,
			messagesToArchive: [],
			messagesToKeep: messages,
			snapshotInsertionIndex: messages.length,
		};
	}

	const archiveBoundary = Math.max(messages.length - keepRecentMessages, 0);
	const archiveableHead = messages.slice(0, archiveBoundary);
	const tail = messages.slice(archiveBoundary);

	const messagesToArchive = archiveableHead.filter(isCompactionCandidate);
	if (messagesToArchive.length < minArchiveCount) {
		return {
			shouldCompact: false,
			messagesToArchive: [],
			messagesToKeep: messages,
			snapshotInsertionIndex: messages.length,
		};
	}

	const preservedHead = archiveableHead.filter((message) => !isCompactionCandidate(message));
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
};

export function buildFallbackSummary(messages: Message[]): string {
	const lines = messages
		.slice(-6)
		.map((message) => {
			const label = ROLE_LABELS[message.role] ?? `[${message.role}]`;
			const text = messageContentToText(message.content, message.role);
			return `${label} ${text}`.trim();
		})
		.filter((line) => line.length > 0);

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
		const body = messageContentToText(message.content, message.role);
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
