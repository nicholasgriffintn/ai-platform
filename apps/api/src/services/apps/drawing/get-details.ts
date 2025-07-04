import { RepositoryManager } from "~/repositories";
import type { IEnv } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { getLogger } from "~/utils/logger";
import type { Drawing } from "./list";

const logger = getLogger();

export async function getDrawingDetails({
  env,
  userId,
  drawingId,
}: {
  env: IEnv;
  userId: number;
  drawingId: string;
}): Promise<Drawing> {
  if (!userId || !drawingId) {
    throw new AssistantError(
      "Drawing ID and user ID are required",
      ErrorType.PARAMS_ERROR,
    );
  }

  const repo = RepositoryManager.getInstance(env).appData;
  const entry = await repo.getAppDataById(drawingId);

  if (!entry || entry.user_id !== userId || entry.app_id !== "drawings") {
    throw new AssistantError("Drawing not found", ErrorType.NOT_FOUND);
  }

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
}
