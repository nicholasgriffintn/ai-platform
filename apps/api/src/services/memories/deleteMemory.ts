import { MemoryManager } from "~/lib/memory";
import { MemoryRepository } from "~/repositories/MemoryRepository";
import type { IEnv, User } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";

export const handleDeleteMemory = async (
  env: IEnv,
  user: User,
  memoryId: string,
): Promise<Record<string, unknown>> => {
  if (!user?.id) {
    throw new AssistantError(
      "User ID is required to delete a memory",
      ErrorType.AUTHENTICATION_ERROR,
    );
  }

  if (!env.DB) {
    throw new AssistantError(
      "Missing database connection",
      ErrorType.CONFIGURATION_ERROR,
    );
  }

  const memoryManager = MemoryManager.getInstance(env, user);

  const deleted = await memoryManager.deleteMemory(memoryId);

  if (!deleted) {
    throw new AssistantError(
      "Memory not found or access denied",
      ErrorType.NOT_FOUND,
    );
  }

  return {
    success: true,
  };
};
