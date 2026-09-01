import type { RepositoryManager } from "~/repositories";
import { getLogger } from "~/utils/logger";

const logger = getLogger({ prefix: "lib/usage/byok" });

export async function isByokTurn(
  repositories: RepositoryManager,
  userId: number,
  provider: string,
): Promise<boolean> {
  try {
    return await repositories.userSettings.hasProviderApiKey(userId, provider);
  } catch (error) {
    logger.warn("Failed to resolve BYOK state for a usage event", { error, userId, provider });

    return false;
  }
}
