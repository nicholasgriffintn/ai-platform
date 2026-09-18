import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { RepositoryManager } from "~/infrastructure/database/repositoryManager";
import { listConfigurableUserProviderIds } from "~/infrastructure/providers/userConfigurableProviders";
import type { IUserSettings, User } from "~/types";

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
  return repositories.userSettings.createUserProviderSettings(
    userId,
    listConfigurableUserProviderIds(),
  );
}

export async function ensureUserProvisioned(
  repositories: RepositoryManager,
  userId: number,
): Promise<void> {
  await createUserSettings(repositories, userId);
  await createUserProviderSettings(repositories, userId);
}
