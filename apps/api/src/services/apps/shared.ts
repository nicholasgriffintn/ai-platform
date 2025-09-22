import { AppDataRepository } from "~/repositories/AppDataRepository";
import type { IEnv } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { generateId } from "~/utils/id";
import { getLogger } from "~/utils/logger";

const logger = getLogger({ prefix: "services/apps/shared" });

export interface ShareItemParams {
  userId: number;
  id: string;
  env: IEnv;
}

export interface SharedItem {
  id: string;
  userId: number;
  appId: string;
  itemId: string;
  itemType?: string;
  data: Record<string, any>;
  shareId: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Shares an app item by generating a share ID
 * @param params - The share item parameters
 * @returns The share ID
 */
export async function shareItem(
  params: ShareItemParams,
): Promise<{ shareId: string }> {
  const { userId, id, env } = params;

  if (!userId) {
    throw new AssistantError("User ID is required", ErrorType.PARAMS_ERROR);
  }

  const appDataRepo = new AppDataRepository(env);

  const appData = await appDataRepo.getAppDataByItemId(id);

  if (!appData || appData.user_id !== userId) {
    throw new AssistantError(
      "Item not found or does not belong to user",
      ErrorType.NOT_FOUND,
    );
  }

  if (appData.share_id) {
    return { shareId: appData.share_id };
  }

  const shareId = generateId();
  await appDataRepo.updateAppDataWithShareId(appData.id, shareId);
  return { shareId };
}

/**
 * Gets a shared app item by its share ID
 * @param env - The environment variables
 * @param shareId - The share ID
 * @returns The shared item
 */
export async function getSharedItem({
  env,
  shareId,
}: {
  env: IEnv;
  shareId: string;
}): Promise<SharedItem> {
  if (!shareId) {
    throw new AssistantError("Share ID is required", ErrorType.PARAMS_ERROR);
  }

  const appDataRepo = new AppDataRepository(env);
  const appData = await appDataRepo.getAppDataByShareId(shareId);

  if (!appData) {
    throw new AssistantError("Shared item not found", ErrorType.NOT_FOUND);
  }

  let parsedData: Record<string, any> = {};
  try {
    parsedData = JSON.parse(appData.data);
  } catch (error) {
    logger.error("Error parsing app data:", {
      error_message: error instanceof Error ? error.message : "Unknown error",
    });
  }

  return {
    id: appData.id,
    userId: appData.user_id,
    appId: appData.app_id,
    itemId: appData.item_id || "",
    itemType: appData.item_type,
    data: parsedData,
    shareId: appData.share_id || "",
    createdAt: appData.created_at,
    updatedAt: appData.updated_at,
  };
}
