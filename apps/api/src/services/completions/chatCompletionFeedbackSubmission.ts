import { gatewayId } from "~/constants/app";
import type { IEnv, IFeedbackBody } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { RepositoryManager } from "~/repositories";
import { getLogger } from "~/utils/logger";

const logger = getLogger({
	prefix: "services/chatCompletionFeedbackSubmission",
});

export const handleChatCompletionFeedbackSubmission = async (req: {
	request: IFeedbackBody;
	env: IEnv;
	user: {
		email: string;
	};
	completion_id: string;
}): Promise<{ success: boolean; message: string; completion_id: string }> => {
	const { request, env, user, completion_id } = req;

	if (!request) {
		throw new AssistantError("Missing request", ErrorType.PARAMS_ERROR);
	}

	if (!request.feedback) {
		throw new AssistantError("Missing feedback", ErrorType.PARAMS_ERROR);
	}

	if (request.log_id && env.AI_GATEWAY_TOKEN && env.ACCOUNT_ID) {
		try {
			if (!env.AI_GATEWAY_TOKEN || !env.ACCOUNT_ID) {
				throw new AssistantError(
					"Missing AI_GATEWAY_TOKEN or ACCOUNT_ID binding",
					ErrorType.PARAMS_ERROR,
				);
			}

			const gateway = env.AI.gateway(gatewayId);
			await gateway.patchLog(request.log_id, {
				// @ts-ignore
				feedback: request.feedback,
				score: request.score,
				metadata: {
					user: user?.email,
				},
			});
		} catch (error) {
			logger.error("Failed to send feedback to AI Gateway", {
				error: error instanceof Error ? error.message : String(error),
				logId: request.log_id,
			});
		}
	}

	try {
		const repositories = new RepositoryManager(env);
		const trainingExamples = await repositories.trainingExamples.findMany({
			conversationId: completion_id,
			source: "chat",
			limit: 1,
		});

		if (trainingExamples.length > 0) {
			const example = trainingExamples[0];
			const updateData: any = {};

			if (request.score !== undefined) {
				updateData.feedback_rating = request.score;
			}

			if (request.feedback) {
				updateData.feedback_comment = request.feedback;
			}

			await repositories.trainingExamples.updateById(example.id, updateData);
			logger.info("Updated training example with feedback", {
				exampleId: example.id,
				completionId: completion_id,
				score: request.score,
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
