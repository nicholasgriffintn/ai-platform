import { MemoryRepository } from "~/repositories/MemoryRepository";
import type { IEnv, User } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";

export const handleCreateMemoryGroup = async (
  env: IEnv,
  user: User,
  title: string,
  description?: string,
  category?: string,
): Promise<Record<string, unknown>> => {
  if (!user?.id) {
    throw new AssistantError(
      "User ID is required to create a memory group",
      ErrorType.AUTHENTICATION_ERROR,
    );
  }

  if (!env.DB) {
    throw new AssistantError(
      "Missing database connection",
      ErrorType.CONFIGURATION_ERROR,
    );
  }

  const repository = new MemoryRepository(env);

  const group = await repository.createMemoryGroup(
    user.id,
    title,
    description,
    category,
  );

  return group;
};
