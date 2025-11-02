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
		const result = await this.runQuery<Memory>(
			`INSERT INTO memories (id, user_id, text, category, vector_id, conversation_id, metadata, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
       RETURNING *`,
			[
				id,
				userId,
				text,
				category,
				vectorId,
				conversationId || null,
				metadata ? JSON.stringify(metadata) : null,
			],
			true,
		);
		return result;
	}

	public async getMemoriesByUserId(userId: number): Promise<Memory[]> {
		const result = await this.runQuery<any>(
			"SELECT * FROM memories WHERE user_id = ? ORDER BY created_at DESC",
			[userId],
		);
		return (result || []) as Memory[];
	}

	public async getMemoryById(memoryId: string): Promise<Memory | null> {
		const result = await this.runQuery<Memory>(
			"SELECT * FROM memories WHERE id = ?",
			[memoryId],
			true,
		);
		return result;
	}

	public async getMemoryByVectorId(vectorId: string): Promise<Memory | null> {
		const result = await this.runQuery<Memory>(
			"SELECT * FROM memories WHERE vector_id = ?",
			[vectorId],
			true,
		);
		return result;
	}

	public async deleteMemory(memoryId: string): Promise<boolean> {
		await this.runQuery("DELETE FROM memories WHERE id = ?", [memoryId], true);
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
		const result = await this.runQuery<MemoryGroup>(
			`INSERT INTO memory_groups (id, user_id, title, description, category, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))
       RETURNING *`,
			[id, userId, title, description || null, category || null],
			true,
		);
		return result;
	}

	public async getMemoryGroupsByUserId(userId: number): Promise<MemoryGroup[]> {
		const result = await this.runQuery<any>(
			"SELECT * FROM memory_groups WHERE user_id = ? ORDER BY created_at DESC",
			[userId],
		);
		return (result || []) as MemoryGroup[];
	}

	public async getMemoryGroupById(
		groupId: string,
	): Promise<MemoryGroup | null> {
		const result = await this.runQuery<MemoryGroup>(
			"SELECT * FROM memory_groups WHERE id = ?",
			[groupId],
			true,
		);
		return result;
	}

	public async deleteMemoryGroup(groupId: string): Promise<boolean> {
		await this.runQuery(
			"DELETE FROM memory_groups WHERE id = ?",
			[groupId],
			true,
		);
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
				await this.runQuery(
					`INSERT INTO memory_group_members (id, group_id, memory_id, created_at)
           VALUES (?, ?, ?, datetime('now'))`,
					[id, groupId, memoryId],
					true,
				);
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
		const result = await this.runQuery<any>(
			"SELECT * FROM memory_group_members WHERE group_id = ? ORDER BY created_at DESC",
			[groupId],
		);
		return (result || []) as MemoryGroupMember[];
	}

	public async getMemoryGroupMemberCount(groupId: string): Promise<number> {
		const result = await this.runQuery<{ count: number }>(
			"SELECT COUNT(*) as count FROM memory_group_members WHERE group_id = ?",
			[groupId],
			true,
		);
		return result?.count || 0;
	}

	public async removeMemoryFromGroups(memoryId: string): Promise<boolean> {
		await this.runQuery(
			"DELETE FROM memory_group_members WHERE memory_id = ?",
			[memoryId],
			true,
		);
		return true;
	}

	public async deleteMemoryGroupMembers(groupId: string): Promise<boolean> {
		await this.runQuery(
			"DELETE FROM memory_group_members WHERE group_id = ?",
			[groupId],
			true,
		);
		return true;
	}
}
