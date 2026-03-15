import type { Message } from "~/types";

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

const DEFAULT_CONTEXT_WINDOW = 8000;
const DEFAULT_TRIGGER_RATIO = 0.7;
const DEFAULT_MIN_MESSAGES = 24;
const DEFAULT_KEEP_RECENT_MESSAGES = 8;
const DEFAULT_MIN_ARCHIVE_COUNT = 6;

function contentToText(content: Message["content"]): string {
	if (typeof content === "string") {
		return content;
	}

	if (Array.isArray(content)) {
		return content
			.map((part) =>
				part.type === "text"
					? part.text || ""
					: part.type === "thinking"
						? part.thinking || ""
						: "",
			)
			.join("\n");
	}

	try {
		return JSON.stringify(content);
	} catch {
		return "";
	}
}

export function estimateMessageTokens(message: Message): number {
	const text = contentToText(message.content);
	return Math.ceil(text.length / 4) + 4;
}

export function estimateConversationTokens(
	messages: Message[],
	latestUserMessage: string,
): number {
	const historyTokens = messages.reduce(
		(sum, message) => sum + estimateMessageTokens(message),
		0,
	);
	return historyTokens + Math.ceil(latestUserMessage.length / 4);
}

function hasSnapshotPart(message: Message): boolean {
	return (
		Array.isArray(message.parts) &&
		message.parts.some((part) => part.type === "snapshot")
	);
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
	const keepRecentMessages =
		config.keepRecentMessages || DEFAULT_KEEP_RECENT_MESSAGES;
	const minArchiveCount = config.minArchiveCount || DEFAULT_MIN_ARCHIVE_COUNT;

	if (messages.length < minMessages) {
		return {
			shouldCompact: false,
			messagesToArchive: [],
			messagesToKeep: messages,
			snapshotInsertionIndex: messages.length,
		};
	}

	const estimatedTokens = estimateConversationTokens(
		messages,
		latestUserMessage,
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

	const preservedHead = archiveableHead.filter(
		(message) => !isCompactionCandidate(message),
	);
	const messagesToKeep = [...preservedHead, ...tail];

	return {
		shouldCompact: true,
		messagesToArchive,
		messagesToKeep,
		snapshotInsertionIndex: preservedHead.length,
	};
}

export function buildFallbackSummary(messages: Message[]): string {
	const important = messages
		.slice(-6)
		.map((message) =>
			`${message.role}: ${contentToText(message.content)}`.trim(),
		)
		.filter((line) => line.length > 0);

	if (important.length === 0) {
		return "Conversation snapshot recorded.";
	}

	return `Earlier context summary:\n${important.join("\n")}`;
}

export function formatMessagesForSummary(
	messages: Message[],
	maxCharacters = 12000,
): string {
	const lines: string[] = [];
	let remaining = maxCharacters;

	for (const message of messages) {
		const line = `${message.role}: ${contentToText(message.content)}`.trim();
		if (!line) {
			continue;
		}

		if (line.length > remaining) {
			if (remaining <= 0) {
				break;
			}
			lines.push(`${line.slice(0, remaining)}...`);
			break;
		}

		lines.push(line);
		remaining -= line.length;
	}

	return lines.join("\n");
}
