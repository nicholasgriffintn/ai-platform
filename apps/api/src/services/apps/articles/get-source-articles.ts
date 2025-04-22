import {
  type AppData,
  AppDataRepository,
} from "~/repositories/AppDataRepository";
import type { IEnv } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";

export interface GetSourceArticlesSuccessResponse {
  status: "success";
  articles: AppData[];
}

/**
 * Gets multiple source articles by their IDs.
 */
export async function getSourceArticles({
  env,
  ids,
  userId,
}: {
  env: IEnv;
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
    const appDataRepo = new AppDataRepository(env);
    const articles: AppData[] = [];

    const articlePromises = ids.map(async (id) => {
      try {
        const article = await appDataRepo.getAppDataById(id);

        if (article && article.user_id === userId) {
          return {
            ...article,
            data: JSON.parse(article.data || "{}"),
          };
        }
        return null;
      } catch (error) {
        console.error(`Error fetching article with ID ${id}:`, error);
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
    console.error("Error fetching source articles:", error);
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
