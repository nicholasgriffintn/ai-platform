import { RepositoryManager } from "~/repositories";
import type { IEnv } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { getLogger } from "~/utils/logger";

const logger = getLogger();

export interface Drawing {
  id: string;
  description: string;
  drawingUrl: string;
  paintingUrl: string;
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, any>;
}

export async function listDrawings({
  env,
  userId,
}: {
  env: IEnv;
  userId: number;
}): Promise<Drawing[]> {
  if (!userId) {
    throw new AssistantError("User ID is required", ErrorType.PARAMS_ERROR);
  }

  const repo = RepositoryManager.getInstance(env).appData;
  const list = await repo.getAppDataByUserAndApp(userId, "drawings");

  return list.map((entry) => {
    let data;
    try {
      data = JSON.parse(entry.data);
    } catch (e) {
      logger.error("Failed to parse drawing data", { error: e });
      data = {};
    }
    return {
      id: entry.id,
      description: data.description,
      drawingUrl: data.drawingUrl,
      paintingUrl: data.paintingUrl,
      createdAt: entry.created_at,
      updatedAt: entry.updated_at,
      metadata: data.metadata,
    };
  });
}
