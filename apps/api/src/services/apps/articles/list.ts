import {
  type AppData,
  AppDataRepository,
} from "~/repositories/AppDataRepository";
import type { IEnv } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { getLogger } from "~/utils/logger";

const logger = getLogger({ prefix: "SERVICES:APPS:ARTICLES:LIST" });

export interface ArticleSessionSummary {
  item_id: string;
  id?: string;
  title: string;
  created_at: string;
  source_article_count?: number;
  status: "processing" | "complete";
}

export interface ListSuccessResponse {
  status: "success";
  sessions: ArticleSessionSummary[];
}

interface SessionItemGroup {
  itemId: string;
  items: AppData[];
}

/**
 * Lists summaries of all article analysis sessions for a user.
 * @param env - The environment variables
 * @param userId - The ID of the user
 * @returns The list of article session summaries
 */
export async function listArticles({
  env,
  userId,
}: {
  env: IEnv;
  userId: number;
}): Promise<ListSuccessResponse> {
  if (!userId) {
    throw new AssistantError("User ID is required", ErrorType.PARAMS_ERROR);
  }

  try {
    const appDataRepo = new AppDataRepository(env);
    const allArticleData = await appDataRepo.getAppDataByUserAndApp(
      userId,
      "articles",
    );

    if (!allArticleData || allArticleData.length === 0) {
      return { status: "success", sessions: [] };
    }

    const sessionMap = new Map<string, SessionItemGroup>();
    for (const appData of allArticleData) {
      if (!appData.item_id) continue;

      const itemId = appData.item_id;
      if (!sessionMap.has(itemId)) {
        sessionMap.set(itemId, { itemId: itemId, items: [] });
      }
      sessionMap.get(itemId)!.items.push(appData);
    }

    const sessions: ArticleSessionSummary[] = Array.from(
      sessionMap.values(),
    ).map((group) => {
      const reportItem = group.items.find(
        (item) => item.item_type === "report",
      );
      const earliestItem = group.items.reduce((earliest, current) => {
        return new Date(current.created_at) < new Date(earliest.created_at)
          ? current
          : earliest;
      });

      let title = `Analysis Session: ${group.itemId}`;
      let sourceArticleCount = 0;
      let reportId: string | undefined;
      const status: ArticleSessionSummary["status"] = reportItem
        ? "complete"
        : "processing";
      const createdAt = reportItem?.created_at || earliestItem.created_at;

      if (reportItem?.data) {
        try {
          let reportData;
          try {
            reportData = JSON.parse(reportItem.data);
          } catch (e) {
            logger.error(
              `Failed to parse report data for itemId ${group.itemId}`,
              e,
            );
            reportData = {};
          }
          title = reportData.title || title;
          sourceArticleCount = reportData.sourceItemIds?.length || 0;
          reportId = reportItem.id;
        } catch (e) {
          logger.error(
            `Failed to parse report data for itemId ${group.itemId}`,
            e,
          );
        }
      }

      return {
        item_id: group.itemId,
        id: reportId,
        title: title,
        created_at: createdAt,
        source_article_count: sourceArticleCount,
        status: status,
      };
    });

    sessions.sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );

    return {
      status: "success",
      sessions: sessions,
    };
  } catch (error) {
    logger.error("Error listing article sessions:", {
      error_message: error instanceof Error ? error.message : "Unknown error",
    });
    if (error instanceof AssistantError) {
      throw error;
    }

    throw new AssistantError(
      "Failed to list article sessions",
      ErrorType.UNKNOWN_ERROR,
      undefined,
      error,
    );
  }
}
