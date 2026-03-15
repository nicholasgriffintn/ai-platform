import type { ConversationManager } from "~/lib/conversationManager";
import { ToolRegistry } from "~/lib/tools/ToolRegistry";
import type { IFunctionResponse, IRequest } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { getLogger } from "~/utils/logger";
import { analyse_hacker_news } from "./analyse_hacker_news";
import { call_api } from "./api_call";
import { search_functions, get_function_schema } from "./discovery";
import { retry_with_backoff, fallback } from "./error_recovery";
import { extract_content } from "./extract_content";
import { request_approval, ask_user } from "./human_in_the_loop";
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
import { compose_functions, if_then_else, parallel_execute } from "./workflow";
import {
	run_bug_fix,
	run_code_review,
	run_documentation,
	run_feature_implementation,
	run_migration,
	run_refactoring,
	run_test_suite,
} from "./sandbox";
import type { ApiToolDefinition } from "./types";

const logger = getLogger({ prefix: "services/functions" });
const FUNCTIONS_TOOL_CATEGORY = "functions";

const functionDefinitions: ApiToolDefinition[] = [
	get_weather,
	create_video,
	create_music,
	create_image,
	fill_in_middle_completion,
	next_edit_completion,
	apply_edit_completion,
	web_search,
	call_api,
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
	search_functions,
	get_function_schema,
	retry_with_backoff,
	fallback,
	compose_functions,
	if_then_else,
	parallel_execute,
	request_approval,
	ask_user,
	run_feature_implementation,
	run_code_review,
	run_test_suite,
	run_bug_fix,
	run_refactoring,
	run_documentation,
	run_migration,
];
export type RegisteredFunctionTool = ApiToolDefinition;

export const toolRegistry = new ToolRegistry();

for (const fn of functionDefinitions) {
	if (!fn) {
		continue;
	}

	toolRegistry.register(FUNCTIONS_TOOL_CATEGORY, {
		name: fn.name,
		metadata: {
			type: fn.type,
			costPerCall: fn.costPerCall,
			isDefault: fn.isDefault ?? false,
		},
		create: () => fn,
	});
}

export const listFunctionTools = (): RegisteredFunctionTool[] =>
	toolRegistry.listDefinitions(
		FUNCTIONS_TOOL_CATEGORY,
	) as RegisteredFunctionTool[];

export const resolveFunctionTool = (
	functionName: string,
): RegisteredFunctionTool =>
	toolRegistry.resolve(
		FUNCTIONS_TOOL_CATEGORY,
		functionName,
	) as RegisteredFunctionTool;

export const validateFunctionArgs = (
	toolDefinition: RegisteredFunctionTool,
	args: unknown,
) => {
	const validation = toolDefinition.inputSchema.safeParse(args);

	if (!validation.success) {
		const validationErrors = validation.error.issues.map((issue) => ({
			path: issue.path.join("."),
			message: issue.message,
		}));

		throw new AssistantError(
			`Invalid arguments for ${toolDefinition.name}`,
			ErrorType.PARAMS_ERROR,
			400,
			{ validationErrors },
		);
	}

	return validation.data;
};

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

	const foundFunction = resolveFunctionTool(functionName);

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

	const validatedArgs = validateFunctionArgs(foundFunction, args);

	const response = await foundFunction.execute(validatedArgs, {
		completionId: completion_id,
		env: request.env,
		user: request.user,
		request,
		appUrl: app_url,
		conversationManager,
	});

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
