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

const DEFAULT_CONTEXT_WINDOW = 32000;
const DEFAULT_TRIGGER_RATIO = 0.7;
const DEFAULT_MIN_MESSAGES = 24;
const DEFAULT_KEEP_RECENT_MESSAGES = 8;
const DEFAULT_MIN_ARCHIVE_COUNT = 6;
const TOOL_RESULT_SUMMARY_LIMIT = 400;

function contentToText(
	content: Message["content"],
	role?: Message["role"],
): string {
	const truncateForTool = (text: string) => {
		if (role === "tool" && text.length > TOOL_RESULT_SUMMARY_LIMIT) {
			return text.slice(0, TOOL_RESULT_SUMMARY_LIMIT) + "…";
		}
		return text;
	};

	if (typeof content === "string") {
		return truncateForTool(content);
	}

	if (Array.isArray(content)) {
		const text = content
			.map((part) =>
				part.type === "text"
					? part.text || ""
					: part.type === "thinking"
						? part.thinking || ""
						: "",
			)
			.join("\n");
		return truncateForTool(text);
	}

	try {
		return truncateForTool(JSON.stringify(content));
	} catch {
		return "";
	}
}

export function estimateMessageTokens(message: Message): number {
	const text = contentToText(message.content, message.role);
	// Tool results are often repetitive structured output; they compress more in
	// practice than prose (~5–6 chars/token vs ~4 for natural language).
	const charsPerToken = message.role === "tool" ? 6 : 4;
	return Math.ceil(text.length / charsPerToken) + 4;
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
			const text = contentToText(message.content, message.role);
			return `${label} ${text}`.trim();
		})
		.filter((line) => line.length > 0);

	if (lines.length === 0) {
		return "Conversation snapshot recorded.";
	}

	return `Earlier context summary:\n${lines.join("\n")}`;
}

export function formatMessagesForSummary(
	messages: Message[],
	maxCharacters = 16000,
): string {
	const lines: string[] = [];
	let remaining = maxCharacters;

	for (const message of messages) {
		const label = ROLE_LABELS[message.role] ?? `[${message.role}]`;
		const body = contentToText(message.content, message.role);
		if (!body) {
			continue;
		}

		const prefix =
			message.role === "tool" && message.name
				? `${label}(${message.name})`
				: label;
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
