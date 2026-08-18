import { createServiceContext, type ServiceContext } from "~/lib/context/serviceContext";
import type { OutputRecord } from "~/repositories/OutputRepository";
import type { IEnv } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { getLogger } from "~/utils/logger";

import { safeParseJson } from "../../../utils/json";

const logger = getLogger({ prefix: "services/apps/articles/list" });

export interface ArticleSessionSummary {
  groupId: string;
  id?: string;
  title: string;
  createdAt: string;
  sourceCount?: number;
  status: "processing" | "complete";
}

export interface ListSuccessResponse {
  status: "success";
  sessions: ArticleSessionSummary[];
}

interface SessionItemGroup {
  itemId: string;
  items: OutputRecord[];
}

export async function listArticles({
  context,
  env,
  userId,
  projectId,
}: {
  context?: ServiceContext;
  env?: IEnv;
  userId: number;
  projectId?: string;
}): Promise<ListSuccessResponse> {
  if (!userId) {
    throw new AssistantError("User ID is required", ErrorType.PARAMS_ERROR);
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
      throw new AssistantError("Service context is required", ErrorType.CONFIGURATION_ERROR);
    }

    serviceContext.ensureDatabase();
    const outputRepo = serviceContext.repositories.outputs;
    const allArticleData = projectId
      ? await outputRepo.listProjectOutputs(projectId, "articles")
      : await outputRepo.listPersonalOutputs(userId, "articles");

    if (!allArticleData || allArticleData.length === 0) {
      return { status: "success", sessions: [] };
    }

    const sessionMap = new Map<string, SessionItemGroup>();

    for (const output of allArticleData) {
      if (!output.group_id) {
        continue;
      }

      const itemId = output.group_id;

      if (!sessionMap.has(itemId)) {
        sessionMap.set(itemId, { itemId: itemId, items: [] });
      }

      sessionMap.get(itemId).items.push(output);
    }

    const sessions: ArticleSessionSummary[] = Array.from(sessionMap.values()).map((group) => {
      const reportItem = group.items.find((item) => item.kind === "report");
      const earliestItem = group.items.reduce((earliest, current) => {
        return new Date(current.created_at) < new Date(earliest.created_at) ? current : earliest;
      });

      let title = `Analysis Session: ${group.itemId}`;
      let sourceArticleCount = 0;
      let reportId: string | undefined;
      const status: ArticleSessionSummary["status"] = reportItem ? "complete" : "processing";
      const createdAt = reportItem?.created_at || earliestItem.created_at;

      if (reportItem?.content) {
        try {
          const reportData = safeParseJson<Record<string, unknown>>(reportItem.content) ?? {};

          title = typeof reportData.title === "string" ? reportData.title : title;
          sourceArticleCount = Array.isArray(reportData.sourceItemIds)
            ? reportData.sourceItemIds.length
            : 0;
          reportId = reportItem.id;
        } catch (e) {
          logger.error(`Failed to parse report data for itemId ${group.itemId}`, e);
        }
      }

      return {
        groupId: group.itemId,
        id: reportId,
        title,
        createdAt,
        sourceCount: sourceArticleCount,
        status,
      };
    });

    sessions.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return {
      status: "success",
      sessions,
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
