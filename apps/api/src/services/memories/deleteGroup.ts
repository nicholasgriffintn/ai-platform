import type { ServiceContext } from "~/lib/context/serviceContext";
import { AssistantError, ErrorType } from "~/utils/errors";

export interface DeleteGroupResponse {
	success: boolean;
}

export async function handleDeleteGroup(
	context: ServiceContext,
	groupId: string,
): Promise<DeleteGroupResponse> {
	context.ensureDatabase();
	const user = context.requireUser();

	const repository = context.repositories.memories;

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
}
