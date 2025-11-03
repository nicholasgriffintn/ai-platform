import type { ServiceContext } from "~/lib/context/serviceContext";
import { AssistantError, ErrorType } from "~/utils/errors";

export const handleAddMemoriesToGroup = async (
	context: ServiceContext,
	groupId: string,
	memoryIds: string[],
): Promise<Record<string, unknown>> => {
	context.ensureDatabase();
	const user = context.requireUser();

	const repository = context.repositories.memories;

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
