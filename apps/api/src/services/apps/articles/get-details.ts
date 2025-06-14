import {
  type AppData,
  AppDataRepository,
} from "~/repositories/AppDataRepository";
import type { IEnv } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { getLogger } from "~/utils/logger";

const logger = getLogger();

export interface GetDetailsSuccessResponse {
  status: "success";
  article: AppData;
}

/**
 * Gets the details of a specific article app data entry by its primary ID.
 * @param env - The environment variables
 * @param id - The ID of the article
 * @param userId - The ID of the user
 * @returns The article details
 */
export async function getArticleDetails({
  env,
  id,
  userId,
}: {
  env: IEnv;
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
    const appDataRepo = new AppDataRepository(env);
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
    console.error("Error fetching article details:", error);
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
