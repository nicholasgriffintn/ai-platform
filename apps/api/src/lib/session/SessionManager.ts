import { getChatProvider } from "~/lib/providers/capabilities/chat";
import { getAuxiliaryModel } from "~/lib/providers/models";
import type { ConversationManager } from "~/lib/conversationManager";
import type { ChatMode, IEnv, Message, IUser } from "~/types";
import { generateId } from "~/utils/id";
import { getLogger } from "~/utils/logger";
import {
	buildCompactionPlan,
	buildFallbackSummary,
	formatMessagesForSummary,
} from "./compaction";
import { getSummarisePrompt } from "~/lib/prompts/summarise";

const logger = getLogger({ prefix: "lib/session/SessionManager" });

interface SessionManagerConfig {
	env: IEnv;
	conversationManager: ConversationManager;
	user?: IUser;
}

export interface CompactSessionInput {
	completionId: string;
	messages: Message[];
	latestUserMessage: string;
	mode?: ChatMode;
	modelConfig?: {
		contextWindow?: number;
	};
}

export interface CompactSessionResult {
	messages: Message[];
	compacted: boolean;
	snapshotMessage?: Message;
}

export class SessionManager {
	private env: IEnv;
	private conversationManager: ConversationManager;
	private user?: IUser;

	constructor(config: SessionManagerConfig) {
		this.env = config.env;
		this.conversationManager = config.conversationManager;
		this.user = config.user;
	}

	public async compact(
		input: CompactSessionInput,
	): Promise<CompactSessionResult> {
		const plan = buildCompactionPlan(input.messages, input.latestUserMessage, {
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
		);

		await this.persistCompaction(
			input.completionId,
			plan.messagesToArchive,
			snapshotMessage,
		);

		const compactedMessages = [...plan.messagesToKeep];
		compactedMessages.splice(plan.snapshotInsertionIndex, 0, snapshotMessage);

		return {
			messages: compactedMessages,
			compacted: true,
			snapshotMessage,
		};
	}

	public async summarise(
		messages: Message[],
		mode?: ChatMode,
	): Promise<string> {
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
				user: this.user,
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

	public snapshot(summary: string, mode?: ChatMode): Message {
		const timestamp = Date.now();
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

	private async persistCompaction(
		completionId: string,
		messagesToArchive: Message[],
		snapshotMessage: Message,
	): Promise<void> {
		const archiveIds = messagesToArchive
			.map((message) => message.id)
			.filter((id): id is string => typeof id === "string" && id.length > 0);

		try {
			await this.conversationManager.add(completionId, snapshotMessage);
			await this.conversationManager.archiveMessages(completionId, archiveIds);
		} catch (error) {
			logger.warn("Failed to persist session compaction", {
				error,
				completionId,
				archivedCount: archiveIds.length,
			});
		}
	}
}
