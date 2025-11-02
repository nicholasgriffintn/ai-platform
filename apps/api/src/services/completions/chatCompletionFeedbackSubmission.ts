import { gatewayId } from "~/constants/app";
import type { IEnv, IFeedbackBody } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";

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

	if (!env.AI_GATEWAY_TOKEN || !env.ACCOUNT_ID) {
		throw new AssistantError(
			"Missing AI_GATEWAY_TOKEN or ACCOUNT_ID binding",
			ErrorType.PARAMS_ERROR,
		);
	}

	if (!request.log_id || !request.feedback) {
		throw new AssistantError(
			"Missing log_id or feedback",
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

	return {
		success: true,
		message: "Feedback submitted successfully",
		completion_id,
	};
};
