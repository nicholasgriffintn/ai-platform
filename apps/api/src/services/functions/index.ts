import type { ConversationManager } from "~/lib/conversationManager";
import type { IFunction, IFunctionResponse, IRequest } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { getLogger } from "~/utils/logger";
import { analyse_hacker_news } from "./analyse_hacker_news";
import { extract_content } from "./extract_content";
import { create_image } from "./image";
import { handleMCPTool } from "./mcp";
import { create_music } from "./music";
import { prompt_coach } from "./prompt_coach";
import { add_reasoning_step } from "./reasoning";
import { capture_screenshot } from "./screenshot";
import { create_speech } from "./speech";
import { fill_in_middle_completion } from "./fill_in_middle";
import { next_edit_completion } from "./next_edit";
import { apply_edit_completion } from "./apply_edit";
import {
	delegateToTeamMember,
	delegateToTeamMemberByRole,
	getTeamMembers,
} from "./teamDelegation";
import { tutor } from "./tutor";
import { v0_code_generation } from "./v0_code_generation";
import { create_video } from "./video";
import { get_weather } from "./weather";
import { web_search } from "./web_search";
import { research } from "./research";
import { extract_text_from_document } from "./ocr";

const logger = getLogger({ prefix: "services/functions" });

export const availableFunctions: IFunction[] = [
	get_weather,
	create_video,
	create_music,
	create_image,
	fill_in_middle_completion,
	next_edit_completion,
	apply_edit_completion,
	web_search,
	research,
	extract_content,
	extract_text_from_document,
	capture_screenshot,
	create_speech,
	tutor,
	prompt_coach,
	add_reasoning_step,
	analyse_hacker_news,
	v0_code_generation,
	delegateToTeamMember,
	delegateToTeamMemberByRole,
	getTeamMembers,
];

export const handleFunctions = async ({
	completion_id,
	app_url,
	functionName,
	args,
	request,
	conversationManager,
}: {
	completion_id: string;
	app_url: string | undefined;
	functionName: string;
	args: unknown;
	request: IRequest;
	conversationManager?: ConversationManager;
}): Promise<IFunctionResponse> => {
	if (functionName.startsWith("mcp_")) {
		request.request = {
			...request.request,
			functionName,
		};

		return handleMCPTool(
			completion_id,
			args,
			request,
			app_url,
			conversationManager,
		);
	}

	const foundFunction = availableFunctions.find(
		(func) => func.name === functionName,
	);

	if (!foundFunction) {
		throw new AssistantError(
			`Function ${functionName} not found`,
			ErrorType.PARAMS_ERROR,
		);
	}

	const isProUser = request.user?.plan_id === "pro";

	if (foundFunction.type === "premium" && !isProUser) {
		throw new AssistantError(
			"This function requires a premium subscription",
			ErrorType.AUTHENTICATION_ERROR,
		);
	}

	if (conversationManager) {
		try {
			await conversationManager.checkUsageLimits(foundFunction.type);
		} catch (error) {
			logger.error("Failed to check usage limits:", {
				error_message: error instanceof Error ? error.message : "Unknown error",
			});
			throw error;
		}
	}

	const response = await foundFunction.function(
		completion_id,
		args,
		request,
		app_url,
		conversationManager,
	);

	if (conversationManager) {
		try {
			await conversationManager.incrementFunctionUsage(
				foundFunction.type === "premium" ? "premium" : "normal",
				isProUser,
				foundFunction.costPerCall,
			);
		} catch (error) {
			logger.error("Failed to track function usage:", {
				error_message: error instanceof Error ? error.message : "Unknown error",
			});
		}
	} else {
		logger.info("No conversation manager provided, skipping usage tracking");
	}

	return response;
};
