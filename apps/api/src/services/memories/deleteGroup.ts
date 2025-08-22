import { MemoryRepository } from "~/repositories/MemoryRepository";
import type { IEnv } from "~/types";
import type { User } from "~/types";

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
      throw new Error("Group not found");
    }

    if (group.user_id !== user.id) {
      throw new Error("Group not found or access denied");
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
