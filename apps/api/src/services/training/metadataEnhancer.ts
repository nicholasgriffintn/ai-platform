import type { ServiceContext } from "~/lib/context/serviceContext";
import { getLogger } from "~/utils/logger";

const logger = getLogger({ prefix: "services/training/metadata-enhancer" });

export interface ConversationContext {
	previousMessages?: Array<{
		role: "user" | "assistant";
		content: string;
		timestamp?: string;
	}>;
	totalTurns?: number;
	conversationStartTime?: string;
}

export interface UserSatisfactionSignals {
	timeOnPage?: number;
	scrollBehavior?: string;
	copyToClipboard?: boolean;
	followUpQuestions?: number;
	sessionDuration?: number;
}

export interface EnhancedMetadata {
	taskCategory?: string;
	difficultyLevel?: "easy" | "medium" | "hard" | "expert";
	languageCode?: string;
	userPromptTokens?: number;
	assistantResponseTokens?: number;
	responseTimeMs?: number;
	conversationTurn?: number;
	conversationContext?: ConversationContext;
	userSatisfactionSignals?: UserSatisfactionSignals;
}

export class TrainingMetadataEnhancer {
	private context: ServiceContext;

	constructor(context: ServiceContext) {
		this.context = context;
	}

	async enhanceMetadata(
		userPrompt: string,
		assistantResponse: string,
		conversationId?: string,
		startTime?: number,
		additionalContext?: {
			previousMessages?: Array<{ role: "user" | "assistant"; content: string }>;
			userBehavior?: UserSatisfactionSignals;
		},
	): Promise<EnhancedMetadata> {
		const metadata: EnhancedMetadata = {};

		try {
			if (startTime) {
				metadata.responseTimeMs = Date.now() - startTime;
			}

			metadata.userPromptTokens = this.estimateTokenCount(userPrompt);
			metadata.assistantResponseTokens =
				this.estimateTokenCount(assistantResponse);

			if (conversationId && additionalContext?.previousMessages) {
				metadata.conversationContext = await this.buildConversationContext(
					conversationId,
					additionalContext.previousMessages,
				);
				metadata.conversationTurn =
					Math.floor(additionalContext.previousMessages.length / 2) + 1;
			}

			if (additionalContext?.userBehavior) {
				metadata.userSatisfactionSignals = additionalContext.userBehavior;
			}

			logger.debug("Enhanced metadata generated", {
				taskCategory: metadata.taskCategory,
				difficultyLevel: metadata.difficultyLevel,
				tokens:
					metadata.userPromptTokens + (metadata.assistantResponseTokens || 0),
				conversationTurn: metadata.conversationTurn,
			});

			return metadata;
		} catch (error) {
			logger.error("Failed to enhance metadata", {
				error: error instanceof Error ? error.message : String(error),
			});
			return metadata;
		}
	}

	private estimateTokenCount(text: string): number {
		return Math.ceil(text.length / 4);
	}

	private async buildConversationContext(
		conversationId: string,
		previousMessages: Array<{ role: "user" | "assistant"; content: string }>,
	): Promise<ConversationContext> {
		try {
			const conversation =
				await this.context.repositories.conversations.getConversation(
					conversationId,
				);

			return {
				previousMessages: previousMessages.map((msg) => ({
					...msg,
					timestamp: new Date().toISOString(), // In real implementation, use actual timestamps
				})),
				totalTurns: Math.ceil(previousMessages.length / 2),
				conversationStartTime:
					typeof conversation?.created_at === "string"
						? conversation.created_at
						: new Date().toISOString(),
			};
		} catch (error) {
			logger.error("Failed to build conversation context", {
				error: error instanceof Error ? error.message : String(error),
				conversationId,
			});

			return {
				totalTurns: Math.ceil(previousMessages.length / 2),
				conversationStartTime: new Date().toISOString(),
			};
		}
	}
}

export async function createEnhancedTrainingMetadata(
	context: ServiceContext,
	userPrompt: string,
	assistantResponse: string,
	options?: {
		conversationId?: string;
		startTime?: number;
		previousMessages?: Array<{ role: "user" | "assistant"; content: string }>;
		userBehavior?: UserSatisfactionSignals;
	},
): Promise<EnhancedMetadata> {
	const enhancer = new TrainingMetadataEnhancer(context);

	return enhancer.enhanceMetadata(
		userPrompt,
		assistantResponse,
		options?.conversationId,
		options?.startTime,
		{
			previousMessages: options?.previousMessages,
			userBehavior: options?.userBehavior,
		},
	);
}
