import { BaseRepository } from "./BaseRepository";
import type {
	MemoryGroup,
	MemoryGroupMember,
	Memory,
} from "~/lib/database/schema";
import { generateId } from "~/utils/id";

export class MemoryRepository extends BaseRepository {
	public async createMemory(
		userId: number,
		text: string,
		category: string,
		vectorId: string,
		conversationId?: string,
		metadata?: Record<string, any>,
	): Promise<Memory | null> {
		const id = generateId();
		const insert = this.buildInsertQuery(
			"memories",
			{
				id,
				user_id: userId,
				text,
				category,
				vector_id: vectorId,
				conversation_id: conversationId ?? null,
				metadata: metadata ?? null,
			},
			{ jsonFields: ["metadata"], returning: "*" },
		);

		if (!insert) {
			return null;
		}

		return this.runQuery<Memory>(insert.query, insert.values, true);
	}

	public async getMemoriesByUserId(userId: number): Promise<Memory[]> {
		const { query, values } = this.buildSelectQuery(
			"memories",
			{ user_id: userId },
			{ orderBy: "created_at DESC" },
		);
		const result = await this.runQuery<Memory>(query, values);
		return result || [];
	}

	public async getMemoryById(memoryId: string): Promise<Memory | null> {
		const { query, values } = this.buildSelectQuery("memories", {
			id: memoryId,
		});
		return this.runQuery<Memory>(query, values, true);
	}

	public async getMemoryByVectorId(vectorId: string): Promise<Memory | null> {
		const { query, values } = this.buildSelectQuery("memories", {
			vector_id: vectorId,
		});
		return this.runQuery<Memory>(query, values, true);
	}

	public async deleteMemory(memoryId: string): Promise<boolean> {
		const { query, values } = this.buildDeleteQuery("memories", {
			id: memoryId,
		});
		await this.executeRun(query, values);
		return true;
	}

	public async getMemoriesInGroup(groupId: string): Promise<Memory[]> {
		const result = await this.runQuery<any>(
			`SELECT m.* FROM memories m 
       INNER JOIN memory_group_members mgm ON m.id = mgm.memory_id 
       WHERE mgm.group_id = ? 
       ORDER BY m.created_at DESC`,
			[groupId],
		);
		return (result || []) as Memory[];
	}

	public async getMemoriesNotInAnyGroup(userId: number): Promise<Memory[]> {
		const result = await this.runQuery<any>(
			`SELECT m.* FROM memories m 
       LEFT JOIN memory_group_members mgm ON m.id = mgm.memory_id 
       WHERE m.user_id = ? AND mgm.memory_id IS NULL 
       ORDER BY m.created_at DESC`,
			[userId],
		);
		return (result || []) as Memory[];
	}

	public async createMemoryGroup(
		userId: number,
		title: string,
		description?: string,
		category?: string,
	): Promise<MemoryGroup | null> {
		const id = generateId();
		const insert = this.buildInsertQuery(
			"memory_groups",
			{
				id,
				user_id: userId,
				title,
				description: description ?? null,
				category: category ?? null,
			},
			{ returning: "*" },
		);

		if (!insert) {
			return null;
		}

		return this.runQuery<MemoryGroup>(insert.query, insert.values, true);
	}

	public async getMemoryGroupsByUserId(userId: number): Promise<MemoryGroup[]> {
		const { query, values } = this.buildSelectQuery(
			"memory_groups",
			{ user_id: userId },
			{ orderBy: "created_at DESC" },
		);
		const result = await this.runQuery<MemoryGroup>(query, values);
		return result || [];
	}

	public async getMemoryGroupById(
		groupId: string,
	): Promise<MemoryGroup | null> {
		const { query, values } = this.buildSelectQuery("memory_groups", {
			id: groupId,
		});
		return this.runQuery<MemoryGroup>(query, values, true);
	}

	public async deleteMemoryGroup(groupId: string): Promise<boolean> {
		const { query, values } = this.buildDeleteQuery("memory_groups", {
			id: groupId,
		});
		await this.executeRun(query, values);
		return true;
	}

	public async addMemoriesToGroup(
		groupId: string,
		memoryIds: string[],
	): Promise<number> {
		let addedCount = 0;
		for (const memoryId of memoryIds) {
			try {
				const id = generateId();
				const insert = this.buildInsertQuery("memory_group_members", {
					id,
					group_id: groupId,
					memory_id: memoryId,
				});

				if (!insert) {
					continue;
				}

				await this.executeRun(insert.query, insert.values);
				addedCount++;
			} catch (error) {
				console.warn(`Failed to add memory ${memoryId} to group:`, error);
			}
		}
		return addedCount;
	}

	public async getMemoryGroupMembers(
		groupId: string,
	): Promise<MemoryGroupMember[]> {
		const { query, values } = this.buildSelectQuery(
			"memory_group_members",
			{ group_id: groupId },
			{ orderBy: "created_at DESC" },
		);
		const result = await this.runQuery<MemoryGroupMember>(query, values);
		return result || [];
	}

	public async getMemoryGroupMemberCount(groupId: string): Promise<number> {
		const { query, values } = this.buildSelectQuery(
			"memory_group_members",
			{ group_id: groupId },
			{ columns: ["COUNT(*) as count"] },
		);
		const result = await this.runQuery<{ count: number }>(query, values, true);
		return result?.count || 0;
	}

	public async removeMemoryFromGroups(memoryId: string): Promise<boolean> {
		const { query, values } = this.buildDeleteQuery("memory_group_members", {
			memory_id: memoryId,
		});
		await this.executeRun(query, values);
		return true;
	}

	public async deleteMemoryGroupMembers(groupId: string): Promise<boolean> {
		const { query, values } = this.buildDeleteQuery("memory_group_members", {
			group_id: groupId,
		});
		await this.executeRun(query, values);
		return true;
	}
}
