import {
	createServiceContext,
	type ServiceContext,
} from "~/lib/context/serviceContext";
import { type AppData } from "~/repositories/AppDataRepository";
import type { IEnv } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { getLogger } from "~/utils/logger";
import { safeParseJson } from "../../../utils/json";

const logger = getLogger({
	prefix: "SERVICES:APPS:ARTICLES:GET_SOURCE_ARTICLES",
});

export interface GetSourceArticlesSuccessResponse {
	status: "success";
	articles: AppData[];
}

export async function getSourceArticles({
	context,
	env,
	ids,
	userId,
}: {
	context?: ServiceContext;
	env?: IEnv;
	ids: string[];
	userId: number;
}): Promise<GetSourceArticlesSuccessResponse> {
	if (!ids || !ids.length) {
		throw new AssistantError(
			"Article IDs are required",
			ErrorType.PARAMS_ERROR,
		);
	}
	if (!userId) {
		throw new AssistantError(
			"User ID is required for lookup",
			ErrorType.PARAMS_ERROR,
		);
	}

	try {
		const serviceContext =
			context ??
			(env
				? createServiceContext({
						env,
						user: null,
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
		const articles: AppData[] = [];

		const articlePromises = ids.map(async (id) => {
			try {
				const article = await appDataRepo.getAppDataById(id);

				if (article && article.user_id === userId) {
					let parsedArticleData = safeParseJson(article.data || "{}");

					return {
						...article,
						data: parsedArticleData,
					};
				}
				return null;
			} catch (error) {
				logger.error(`Error fetching article with ID ${id}:`, {
					error_message:
						error instanceof Error ? error.message : "Unknown error",
				});
				return null;
			}
		});

		const fetchedArticles = await Promise.all(articlePromises);

		for (const article of fetchedArticles) {
			if (article) {
				articles.push(article);
			}
		}

		return {
			status: "success",
			articles,
		};
	} catch (error) {
		logger.error("Error fetching source articles:", {
			error_message: error instanceof Error ? error.message : "Unknown error",
		});
		if (error instanceof AssistantError) {
			throw error;
		}
		throw new AssistantError(
			"Failed to get source articles",
			ErrorType.UNKNOWN_ERROR,
			undefined,
			error,
		);
	}
}
