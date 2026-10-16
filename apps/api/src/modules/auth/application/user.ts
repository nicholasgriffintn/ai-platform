import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { Repositories } from "~/infrastructure/database/repositories";
import { listConfigurableUserProviderIds } from "~/infrastructure/providers/userConfigurableProviders";
import { UserRepository } from "~/modules/user/infrastructure/UserRepository";
import { UserSettingsRepository } from "~/modules/user/infrastructure/UserSettingsRepository";
import type { IUserSettings, User } from "~/types";

const logger = getLogger({ prefix: "services/auth/user" });

export async function getUserSettings(
  repositories: Repositories,
  userId: number,
): Promise<IUserSettings | null> {
  try {
    if (!userId) {
      return null;
    }

    return await repositories.get(UserSettingsRepository).getUserSettings(userId);
  } catch (cause) {
    logger.error("Error getting user settings:", { error: cause });
    throw new AssistantError("Failed to retrieve user settings", ErrorType.UNKNOWN_ERROR, 500, {
      cause,
    });
  }
}

export async function getUserById(
  repositories: Repositories,
  userId: number,
): Promise<User | null> {
  try {
    return await repositories.get(UserRepository).getUserById(userId);
  } catch (cause) {
    logger.error("Error getting user by ID:", { error: cause });
    throw new AssistantError("Failed to retrieve user by ID", ErrorType.UNKNOWN_ERROR, 500, {
      cause,
    });
  }
}

export function createUserSettings(repositories: Repositories, userId: number): Promise<void> {
  return repositories.get(UserSettingsRepository).createUserSettings(userId);
}

export function createUserProviderSettings(
  repositories: Repositories,
  userId: number,
): Promise<void> {
  return repositories
    .get(UserSettingsRepository)
    .createUserProviderSettings(userId, listConfigurableUserProviderIds());
}

export async function ensureUserProvisioned(
  repositories: Repositories,
  userId: number,
): Promise<void> {
  await createUserSettings(repositories, userId);
  await createUserProviderSettings(repositories, userId);
}
