import {
	getAuxiliaryModelForRetrieval,
	getModelConfigByMatchingModel,
} from "~/lib/models";
import { generateArticleReportPrompt } from "~/lib/prompts";
import { AIProviderFactory } from "~/lib/providers/factory";
import {
	createServiceContext,
	type ServiceContext,
} from "~/lib/context/serviceContext";
import type { IEnv, IUser } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { extractQuotes } from "~/utils/extract";
import { getLogger } from "~/utils/logger";
import { verifyQuotes } from "~/utils/verify";
import { safeParseJson } from "../../../utils/json";

const logger = getLogger({
	prefix: "services/apps/articles/generate-report",
});

export interface Params {
	itemId: string;
}

export interface GenerateReportSuccessResponse {
	status: "success";
	message?: string;
	appDataId?: string;
	itemId?: string;
}

export async function generateArticlesReport({
	completion_id,
	app_url,
	context,
	env,
	args,
	user,
}: {
	completion_id: string;
	app_url: string | undefined;
	context?: ServiceContext;
	env?: IEnv;
	args: Params;
	user: IUser;
}): Promise<GenerateReportSuccessResponse> {
	if (!user.id) {
		throw new AssistantError("User ID is required", ErrorType.PARAMS_ERROR);
	}
	if (!args.itemId) {
		throw new AssistantError("Item ID is required", ErrorType.PARAMS_ERROR);
	}

	try {
		const serviceContext =
			context ??
			(env
				? createServiceContext({
						env,
						user,
					})
				: null);

		if (!serviceContext) {
			throw new AssistantError(
				"Service context is required",
				ErrorType.CONFIGURATION_ERROR,
			);
		}

		serviceContext.ensureDatabase();
		const appDataRepo = serviceContext.repositories.appData;

		const relatedItems = await appDataRepo.getAppDataByUserAppAndItem(
			user.id,
			"articles",
			args.itemId,
		);

		const analysisItems = relatedItems.filter(
			(item) => item.item_type === "analysis",
		);

		if (analysisItems.length === 0) {
			throw new AssistantError(
				`No analysis data found for itemId: ${args.itemId}`,
				ErrorType.NOT_FOUND,
			);
		}

		const combinedArticles = analysisItems
			.map((item) => {
				let parsed = safeParseJson(item.data || "{}") ?? {};
				return parsed.originalArticle;
			})
			.filter((content): content is string => !!content)
			.join("\n\n---\n\n");

		if (!combinedArticles || combinedArticles.trim().length === 0) {
			throw new AssistantError(
				"Could not extract article content from saved analysis data.",
				ErrorType.INTERNAL_ERROR,
			);
		}

		const { model: modelToUse, provider: providerToUse } =
			await getAuxiliaryModelForRetrieval(serviceContext.env, user);
		const modelConfig = await getModelConfigByMatchingModel(modelToUse);
		const provider = AIProviderFactory.getProvider(providerToUse);

		const reportGenData = await provider.getResponse({
			completion_id,
			app_url,
			model: modelToUse,
			messages: [
				{
					role: "user",
					content: generateArticleReportPrompt(combinedArticles, {
						modelId: modelToUse,
						modelConfig,
					}),
				},
			],
			env: serviceContext.env,
			user,
		});

		const reportGenDataContent =
			reportGenData.content || reportGenData.response;

		if (!reportGenDataContent) {
			throw new AssistantError(
				"Report content was empty",
				ErrorType.PARAMS_ERROR,
			);
		}

		const quotes = extractQuotes(reportGenDataContent);
		const verifiedQuotes = verifyQuotes(combinedArticles, quotes);

		const reportResult = {
			content: reportGenDataContent,
			model: modelToUse,
			id: reportGenData.id,
			citations: reportGenData.citations,
			log_id: reportGenData.log_id,
			verifiedQuotes: verifiedQuotes,
		};

		const reportAppData = {
			sourceItemIds: analysisItems.map((item) => item.id),
			report: reportResult,
			title: `Report for Analysis Session ${args.itemId} (${analysisItems.length} articles)`,
		};

		const savedReport = await appDataRepo.createAppDataWithItem(
			user.id,
			"articles",
			args.itemId,
			"report",
			reportAppData,
		);

		return {
			status: "success",
			message: "Article report generated and saved.",
			appDataId: savedReport.id,
			itemId: args.itemId,
		};
	} catch (error) {
		logger.error("Error generating article report:", {
			error_message: error instanceof Error ? error.message : "Unknown error",
		});
		if (error instanceof AssistantError) {
			throw error;
		}
		throw new AssistantError(
			"Failed to generate report",
			ErrorType.UNKNOWN_ERROR,
			undefined,
			error,
		);
	}
}
