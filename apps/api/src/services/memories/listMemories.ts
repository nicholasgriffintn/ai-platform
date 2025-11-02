import { MemoryRepository } from "~/repositories/MemoryRepository";
import type { IEnv, User } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";

export const handleListMemories = async (
	env: IEnv,
	user: User,
	groupId?: string,
): Promise<Record<string, unknown>> => {
	if (!user?.id) {
		throw new AssistantError(
			"User ID is required to list memories",
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

	const memoryGroups = await repository.getMemoryGroupsByUserId(user.id);
	const groupsWithCounts = await Promise.all(
		memoryGroups.map(async (group) => {
			const memberCount = await repository.getMemoryGroupMemberCount(group.id);
			return {
				id: group.id,
				title: group.title,
				description: group.description,
				category: group.category,
				member_count: memberCount,
				created_at: group.created_at,
			};
		}),
	);

	let memories;
	if (groupId) {
		memories = await repository.getMemoriesInGroup(groupId);
	} else {
		memories = await repository.getMemoriesByUserId(user.id);
	}

	const allGroupMemberships = new Map<
		string,
		{ groupId: string; groupTitle: string }
	>();

	for (const group of groupsWithCounts) {
		const groupMembers = await repository.getMemoryGroupMembers(group.id);
		for (const member of groupMembers) {
			allGroupMemberships.set(member.memory_id, {
				groupId: group.id,
				groupTitle: group.title,
			});
		}
	}

	const formattedMemories = memories.map((memory) => {
		const groupInfo = allGroupMemberships.get(memory.id);

		return {
			id: memory.id,
			text: memory.text,
			category: memory.category,
			created_at: memory.created_at,
			group_id: groupInfo?.groupId || null,
			group_title: groupInfo?.groupTitle || null,
		};
	});

	return {
		memories: formattedMemories,
		groups: groupsWithCounts,
	};
};
