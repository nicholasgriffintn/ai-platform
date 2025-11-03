import {
	createServiceContext,
	type ServiceContext,
} from "~/lib/context/serviceContext";
import { type AppData } from "~/repositories/AppDataRepository";
import type { IEnv } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { getLogger } from "~/utils/logger";

const logger = getLogger({ prefix: "services/apps/articles/get-details" });

export interface GetDetailsSuccessResponse {
	status: "success";
	article: AppData;
}

export async function getArticleDetails({
	context,
	env,
	id,
	userId,
}: {
	context?: ServiceContext;
	env?: IEnv;
	id: string;
	userId: number;
}): Promise<GetDetailsSuccessResponse> {
	if (!id) {
		throw new AssistantError("Article ID is required", ErrorType.PARAMS_ERROR);
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
		const article = await appDataRepo.getAppDataById(id);

		if (!article) {
			throw new AssistantError("Article data not found", ErrorType.NOT_FOUND);
		}

		if (article.user_id !== userId) {
			throw new AssistantError("Forbidden", ErrorType.FORBIDDEN);
		}

		let parsedArticleData;
		try {
			parsedArticleData = JSON.parse(article.data || "{}");
		} catch (e) {
			logger.error("Failed to parse article data", { error: e });
			parsedArticleData = {};
		}

		const parsedArticle: AppData = {
			...article,
			data: parsedArticleData,
		};

		return {
			status: "success",
			article: parsedArticle,
		};
	} catch (error) {
		logger.error("Error fetching article details:", {
			error_message: error instanceof Error ? error.message : "Unknown error",
		});
		if (error instanceof AssistantError) {
			throw error;
		}
		throw new AssistantError(
			"Failed to get article details",
			ErrorType.UNKNOWN_ERROR,
			undefined,
			error,
		);
	}
}
