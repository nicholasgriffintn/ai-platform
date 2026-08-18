import type { RepositoryManager } from "~/repositories";
import type { IUserSettings, User } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { getLogger } from "~/utils/logger";

const logger = getLogger({ prefix: "services/auth/user" });

export async function getUserSettings(
  repositories: RepositoryManager,
  userId: number,
): Promise<IUserSettings | null> {
  try {
    if (!userId) {
      return null;
    }

    return await repositories.userSettings.getUserSettings(userId);
  } catch (cause) {
    logger.error("Error getting user settings:", { error: cause });
    throw new AssistantError("Failed to retrieve user settings", ErrorType.UNKNOWN_ERROR, 500, {
      cause,
    });
  }
}

export async function getUserById(
  repositories: RepositoryManager,
  userId: number,
): Promise<User | null> {
  try {
    return await repositories.users.getUserById(userId);
  } catch (cause) {
    logger.error("Error getting user by ID:", { error: cause });
    throw new AssistantError("Failed to retrieve user by ID", ErrorType.UNKNOWN_ERROR, 500, {
      cause,
    });
  }
}

export function createUserSettings(repositories: RepositoryManager, userId: number): Promise<void> {
  return repositories.userSettings.createUserSettings(userId);
}

export function createUserProviderSettings(
  repositories: RepositoryManager,
  userId: number,
): Promise<void> {
  return repositories.userSettings.createUserProviderSettings(userId);
}
