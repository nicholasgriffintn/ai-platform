import { compactionStatusLabels } from "@assistant/schemas";
import { getChatProvider } from "~/lib/providers/capabilities/chat";
import { createServiceContext } from "~/lib/context/serviceContext";
import { getAuxiliaryModel } from "~/lib/providers/models";
import type { ChatMode, IEnv, Message, IUser } from "~/types";
import { generateId } from "~/utils/id";
import { getLogger } from "~/utils/logger";
import {
	buildCompactionPlan,
	buildFallbackSummary,
	type CompactionMode,
	formatMessagesForSummary,
} from "./compaction";
import { getSummarisePrompt } from "~/lib/prompts/summarise";

const logger = getLogger({ prefix: "lib/session/SessionManager" });

export interface SessionConversationStore {
	add(conversationId: string, message: Message): Promise<Message>;
	archiveMessages(conversationId: string, messageIds: string[]): Promise<void>;
	deleteMessages(conversationId: string, messageIds: string[]): Promise<void>;
}

interface SessionManagerConfig {
	env: IEnv;
	conversationManager: SessionConversationStore;
	user?: IUser;
}

export interface CompactSessionInput {
	completionId: string;
	messages: Message[];
	compaction?: CompactionMode;
	mode?: ChatMode;
	modelConfig?: {
		contextWindow?: number;
	};
}

export interface CompactSessionResult {
	messages: Message[];
	compacted: boolean;
	snapshotMessage?: Message;
	compactionMessage?: Message;
}

export class SessionManager {
	private env: IEnv;
	private conversationManager: SessionConversationStore;
	private user?: IUser;

	constructor(config: SessionManagerConfig) {
		this.env = config.env;
		this.conversationManager = config.conversationManager;
		this.user = config.user;
	}

	public async compact(input: CompactSessionInput): Promise<CompactSessionResult> {
		const plan = buildCompactionPlan(input.messages, {
			mode: input.compaction,
			contextWindow: input.modelConfig?.contextWindow,
		});

		if (!plan.shouldCompact) {
			return {
				messages: input.messages,
				compacted: false,
			};
		}

		const summary = await this.summarise(plan.messagesToArchive, input.mode);
		const snapshotMessage = this.snapshot(
			summary,
			input.mode || plan.messagesToArchive.at(-1)?.mode,
			this.getSnapshotTimestamp(plan.messagesToKeep[plan.snapshotInsertionIndex]),
		);
		const compactionMessage = this.compactionMarker({
			completionId: input.completionId,
			snapshotMessage,
			compaction: input.compaction ?? "auto",
			mode: input.mode || plan.messagesToArchive.at(-1)?.mode,
		});

		await this.persistCompaction(
			input.completionId,
			plan.messagesToArchive,
			snapshotMessage,
			compactionMessage,
		);

		const compactedMessages = [...plan.messagesToKeep];
		compactedMessages.splice(plan.snapshotInsertionIndex, 0, snapshotMessage);

		return {
			messages: compactedMessages,
			compacted: true,
			snapshotMessage,
			compactionMessage,
		};
	}

	public async summarise(messages: Message[], mode?: ChatMode): Promise<string> {
		if (messages.length === 0) {
			return "Conversation snapshot recorded.";
		}

		const summaryInput = formatMessagesForSummary(messages);
		if (!summaryInput) {
			return "Conversation snapshot recorded.";
		}

		try {
			const { model, provider } = await getAuxiliaryModel(this.env, this.user);
			const chatProvider = getChatProvider(provider, {
				env: this.env,
				user: this.user,
			});

			const modeHint = mode ? `The conversation was in "${mode}" mode.` : "";

			const response = await chatProvider.getResponse({
				env: this.env,
				context: createServiceContext({ env: this.env, user: this.user }),
				model,
				messages: [
					{
						role: "system",
						content: getSummarisePrompt({ modeHint }),
					},
					{
						role: "user",
						content: summaryInput,
					},
				],
			});

			if (typeof response?.response === "string" && response.response.trim()) {
				return response.response.trim();
			}
		} catch (error) {
			logger.warn("Failed to summarise archived messages", {
				error,
				count: messages.length,
			});
		}

		return buildFallbackSummary(messages);
	}

	public snapshot(summary: string, mode?: ChatMode, timestamp = Date.now()): Message {
		return {
			id: generateId(),
			role: "assistant",
			content: `Conversation snapshot\n\n${summary}`,
			parts: [
				{
					type: "snapshot",
					title: "Conversation snapshot",
					summary,
					timestamp,
				},
				{
					type: "text",
					text: `Conversation snapshot\n\n${summary}`,
					timestamp,
				},
			],
			mode,
			timestamp,
		};
	}

	public compactionMarker({
		completionId,
		snapshotMessage,
		compaction,
		mode,
	}: {
		completionId: string;
		snapshotMessage: Message;
		compaction: CompactionMode;
		mode?: ChatMode;
	}): Message {
		const label =
			compaction === "manual"
				? compactionStatusLabels.manualCompleted
				: compactionStatusLabels.automaticCompleted;
		const timestamp =
			typeof snapshotMessage.timestamp === "number" ? snapshotMessage.timestamp : Date.now();

		return {
			id: `${snapshotMessage.id}-compaction`,
			completion_id: completionId,
			role: "compaction",
			content: label,
			parts: [
				{
					type: "compaction",
					status: "completed",
					label,
					timestamp,
				},
			],
			mode,
			timestamp,
		};
	}

	private getSnapshotTimestamp(nextMessage?: Message): number {
		const nextTimestamp = nextMessage?.timestamp;

		if (typeof nextTimestamp !== "number" || !Number.isFinite(nextTimestamp)) {
			return Date.now();
		}

		return Math.max(0, nextTimestamp - 1);
	}

	private async persistCompaction(
		completionId: string,
		messagesToArchive: Message[],
		snapshotMessage: Message,
		compactionMessage: Message,
	): Promise<void> {
		const archiveIds = messagesToArchive
			.map((message) => message.id)
			.filter((id): id is string => typeof id === "string" && id.length > 0);

		try {
			await this.conversationManager.add(completionId, snapshotMessage);
			await this.conversationManager.add(completionId, compactionMessage);
			await this.conversationManager.archiveMessages(completionId, [
				...archiveIds,
				compactionMessage.id!,
			]);
		} catch (error) {
			logger.warn("Failed to persist session compaction", {
				error,
				completionId,
				archivedCount: archiveIds.length,
			});
			await this.cleanupInsertedCompactionMessages(
				completionId,
				snapshotMessage,
				compactionMessage,
				error,
			);
			throw error;
		}
	}

	private async cleanupInsertedCompactionMessages(
		completionId: string,
		snapshotMessage: Message,
		compactionMessage: Message,
		originalError: unknown,
	): Promise<void> {
		const messageIds = [snapshotMessage.id, compactionMessage.id].filter(
			(id): id is string => typeof id === "string" && id.length > 0,
		);

		if (messageIds.length === 0) {
			return;
		}

		try {
			await this.conversationManager.deleteMessages(completionId, messageIds);
		} catch (cleanupError) {
			logger.warn("Failed to clean up partial session compaction", {
				error: cleanupError,
				originalError,
				completionId,
				messageIds,
			});
		}
	}
}
