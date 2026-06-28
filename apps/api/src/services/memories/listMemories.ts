import type { ServiceContext } from "~/lib/context/serviceContext";
import { formatMemoryListItem } from "./formatMemory";

export const handleListMemories = async (
	context: ServiceContext,
	groupId?: string,
): Promise<Record<string, unknown>> => {
	context.ensureDatabase();
	const user = context.requireUser();

	const repository = context.repositories.memories;

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

	const allGroupMemberships = new Map<string, { groupId: string; groupTitle: string }>();

	for (const group of groupsWithCounts) {
		const groupMembers = await repository.getMemoryGroupMembers(group.id);
		for (const member of groupMembers) {
			allGroupMemberships.set(member.memory_id, {
				groupId: group.id,
				groupTitle: group.title,
			});
		}
	}

	const formattedMemories = memories.map((memory) =>
		formatMemoryListItem(memory, allGroupMemberships.get(memory.id)),
	);

	return {
		memories: formattedMemories,
		groups: groupsWithCounts,
	};
};
