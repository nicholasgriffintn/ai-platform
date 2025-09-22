import { MemoryRepository } from "~/repositories/MemoryRepository";
import type { IEnv } from "~/types";
import type { User } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";

export interface DeleteGroupResponse {
  success: boolean;
}

export async function handleDeleteGroup(
  env: IEnv,
  user: User,
  groupId: string,
): Promise<DeleteGroupResponse> {
  try {
    const repository = new MemoryRepository(env);

    const group = await repository.getMemoryGroupById(groupId);
    if (!group) {
      throw new AssistantError("Group not found", ErrorType.NOT_FOUND);
    }

    if (group.user_id !== user.id) {
      throw new AssistantError(
        "Group not found or access denied",
        ErrorType.FORBIDDEN,
      );
    }

    await repository.deleteMemoryGroupMembers(groupId);

    await repository.deleteMemoryGroup(groupId);

    return {
      success: true,
    };
  } catch (error) {
    console.error("Error deleting group:", error);
    throw error;
  }
}
