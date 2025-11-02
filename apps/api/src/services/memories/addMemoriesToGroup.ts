import { MemoryRepository } from "~/repositories/MemoryRepository";
import type { IEnv, User } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";

export const handleAddMemoriesToGroup = async (
	env: IEnv,
	user: User,
	groupId: string,
	memoryIds: string[],
): Promise<Record<string, unknown>> => {
	if (!user?.id) {
		throw new AssistantError(
			"User ID is required to add memories to group",
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

	const group = await repository.getMemoryGroupById(groupId);
	if (!group || group.user_id !== user.id) {
		throw new AssistantError(
			"Group not found or access denied",
			ErrorType.AUTHENTICATION_ERROR,
		);
	}

	await repository.addMemoriesToGroup(groupId, memoryIds);

	return {
		success: true,
		added_count: memoryIds.length,
	};
};
