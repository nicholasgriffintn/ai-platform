import { ChatCompletionParameters } from "~/types";

export function getAiGatewayMetadataHeaders(
	params: ChatCompletionParameters,
): Record<string, string | unknown> {
	return {
		email: params.user?.email,
		userId: params.user?.id,
		platform: params.platform,
		completionId: params.completion_id,
	};
}
