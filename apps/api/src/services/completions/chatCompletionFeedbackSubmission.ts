import type { SubmitChatCompletionFeedbackInput } from "@assistant/schemas";

import { gatewayId } from "~/constants/app";
import type { TrainingExampleRepository } from "~/repositories";
import { getLogger } from "~/utils/logger";

const logger = getLogger({
	prefix: "services/chatCompletionFeedbackSubmission",
});

interface FeedbackParams {
	authorise: () => Promise<void>;
	request: SubmitChatCompletionFeedbackInput;
	completion_id: string;
}

interface FeedbackGateway {
	patchLog(
		logId: string,
		data: {
			feedback: 1 | -1;
			score?: number;
			metadata?: Record<string, string>;
		},
	): Promise<void>;
}

export interface ChatFeedbackContext {
	env: {
		AI_GATEWAY_TOKEN?: string;
		ACCOUNT_ID?: string;
		AI: {
			gateway(id: string): FeedbackGateway;
		};
	};
	user?: { email?: string } | null;
	repositories: {
		trainingExamples: Pick<TrainingExampleRepository, "findMany" | "updateById">;
	};
}

export const handleChatCompletionFeedbackSubmission = async (
	context: ChatFeedbackContext,
	{ request, completion_id, authorise }: FeedbackParams,
): Promise<{ success: boolean; message: string; completion_id: string }> => {
	await authorise();
	const { env, user } = context;

	if (env.AI_GATEWAY_TOKEN && env.ACCOUNT_ID) {
		try {
			const gateway = env.AI.gateway(gatewayId);
			await gateway.patchLog(request.log_id, {
				feedback: request.feedback,
				score: request.score,
				metadata: user?.email ? { user: user.email } : undefined,
			});
		} catch (error) {
			logger.error("Failed to send feedback to AI Gateway", {
				error: error instanceof Error ? error.message : String(error),
				logId: request.log_id,
			});
		}
	}

	try {
		const trainingExamples = await context.repositories.trainingExamples.findMany({
			conversationId: completion_id,
			source: "chat",
			limit: 1,
		});
		const [example] = trainingExamples;

		if (example) {
			await context.repositories.trainingExamples.updateById(example.id, {
				feedback_rating: request.feedback === 1 ? 5 : 1,
			});
			logger.info("Updated training example with feedback", {
				exampleId: example.id,
				completionId: completion_id,
				feedback: request.feedback,
			});
		}
	} catch (error) {
		logger.error("Failed to update training example with feedback", {
			error: error instanceof Error ? error.message : String(error),
			completionId: completion_id,
		});
	}

	return {
		success: true,
		message: "Feedback submitted successfully",
		completion_id,
	};
};
