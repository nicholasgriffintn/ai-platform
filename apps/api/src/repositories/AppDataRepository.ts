import { KVCache } from "~/lib/cache";
import { AssistantError, ErrorType } from "~/utils/errors";
import type { IEnv } from "~/types";
import { generateId } from "~/utils/id";
import { BaseRepository } from "./BaseRepository";

export interface AppData {
	id: string;
	user_id: number;
	app_id: string;
	item_id?: string;
	item_type?: string;
	data: string;
	share_id?: string;
	created_at: string;
	updated_at: string;
}

const APP_DATA_CACHE_TTL = 1800; // 30 minutes

export class AppDataRepository extends BaseRepository {
	private cache: KVCache | null = null;

	constructor(env: IEnv) {
		super(env);
		if (env.CACHE) {
			this.cache = new KVCache(env.CACHE, APP_DATA_CACHE_TTL);
		}
	}

	/**
	 * Creates a new app data entry
	 * @param userId - The user ID
	 * @param appId - The app ID
	 * @param data - The data to create
	 * @returns The created app data
	 */
	public async createAppData(
		userId: number,
		appId: string,
		data: Record<string, any>,
	): Promise<AppData> {
		const id = generateId();

		const insert = this.buildInsertQuery(
			"app_data",
			{
				id,
				user_id: userId,
				app_id: appId,
				data,
			},
			{ jsonFields: ["data"], returning: "*" },
		);

		if (!insert) {
			throw new AssistantError(
				"Failed to build app data insert query",
				ErrorType.INTERNAL_ERROR,
			);
		}

		const created = await this.runQuery<AppData>(
			insert.query,
			insert.values,
			true,
		);

		await this.invalidateUserAppCache(userId, appId);

		if (!created) {
			throw new AssistantError(
				"Failed to create app data",
				ErrorType.INTERNAL_ERROR,
			);
		}

		return created;
	}

	/**
	 * Creates a new app data entry with item_id and item_type
	 * @param userId - The user ID
	 * @param appId - The app ID
	 * @param itemId - The item ID
	 * @param itemType - The item type
	 * @param data - The data to create
	 * @returns The created app data
	 */
	public async createAppDataWithItem(
		userId: number,
		appId: string,
		itemId: string,
		itemType: string,
		data: Record<string, any>,
	): Promise<AppData> {
		const id = generateId();

		const insert = this.buildInsertQuery(
			"app_data",
			{
				id,
				user_id: userId,
				app_id: appId,
				item_id: itemId,
				item_type: itemType,
				data,
			},
			{ jsonFields: ["data"], returning: "*" },
		);

		if (!insert) {
			throw new AssistantError(
				"Failed to build app data insert query",
				ErrorType.INTERNAL_ERROR,
			);
		}

		const created = await this.runQuery<AppData>(
			insert.query,
			insert.values,
			true,
		);

		await this.invalidateUserAppCache(userId, appId);

		if (!created) {
			throw new AssistantError(
				"Failed to create app data",
				ErrorType.INTERNAL_ERROR,
			);
		}

		return created;
	}

	/**
	 * Gets app data by ID with caching
	 * @param id - The app data ID
	 * @returns The app data or null if not found
	 */
	public async getAppDataById(id: string): Promise<AppData | null> {
		const cacheKey = KVCache.createKey("app-data", id);

		if (this.cache) {
			return this.cache.cacheQuery(
				cacheKey,
				() => {
					const { query, values } = this.buildSelectQuery("app_data", { id });
					return this.runQuery<AppData>(query, values, true);
				},
				{ ttl: APP_DATA_CACHE_TTL },
			);
		}

		const { query, values } = this.buildSelectQuery("app_data", { id });
		return this.runQuery<AppData>(query, values, true);
	}

	/**
	 * Gets app data by item id
	 * @param id - The ID of the item
	 * @returns The app data
	 */
	public async getAppDataByItemId(id: string): Promise<AppData | null> {
		const { query, values } = this.buildSelectQuery("app_data", {
			item_id: id,
		});
		return this.runQuery<AppData>(query, values, true);
	}

	/**
	 * Gets app data by app id and item id
	 * @param appId - The app ID
	 * @param itemId - The item ID
	 * @returns The app data or null if not found
	 */
	public async getAppDataByAppAndItemId(
		appId: string,
		itemId: string,
	): Promise<AppData | null> {
		const { query, values } = this.buildSelectQuery(
			"app_data",
			{
				app_id: appId,
				item_id: itemId,
			},
			{ orderBy: "updated_at DESC" },
		);
		return this.runQuery<AppData>(query, values, true);
	}

	/**
	 * Gets all app data for a user and specific app with caching
	 * @param userId - The user ID
	 * @param appId - The app ID
	 * @returns The app data
	 */
	public async getAppDataByUserAndApp(
		userId: number,
		appId: string,
	): Promise<AppData[]> {
		const cacheKey = KVCache.createKey(
			"app-data-user-app",
			userId.toString(),
			appId,
		);

		if (this.cache) {
			return this.cache.cacheQuery(
				cacheKey,
				() => {
					const { query, values } = this.buildSelectQuery(
						"app_data",
						{ user_id: userId, app_id: appId },
						{ orderBy: "created_at DESC" },
					);
					return this.runQuery<AppData>(query, values);
				},
				{ ttl: Math.min(APP_DATA_CACHE_TTL, 900) },
			);
		}

		const { query, values } = this.buildSelectQuery(
			"app_data",
			{ user_id: userId, app_id: appId },
			{ orderBy: "created_at DESC" },
		);
		return this.runQuery<AppData>(query, values);
	}

	/**
	 * Gets all app data records for an app id
	 * @param appId - The app ID
	 * @returns Matching app data rows
	 */
	public async getAppDataByApp(appId: string): Promise<AppData[]> {
		const { query, values } = this.buildSelectQuery(
			"app_data",
			{ app_id: appId },
			{ orderBy: "updated_at DESC" },
		);
		return this.runQuery<AppData>(query, values);
	}

	/**
	 * Gets all app data for a user, app, item_id and optionally item_type
	 * @param userId - The user ID
	 * @param appId - The app ID
	 * @param itemId - The item ID
	 * @param itemType - The item type
	 * @returns The app data
	 */
	public async getAppDataByUserAppAndItem(
		userId: number,
		appId: string,
		itemId: string,
		itemType?: string,
	): Promise<AppData[]> {
		const { query, values } = this.buildSelectQuery(
			"app_data",
			{
				user_id: userId,
				app_id: appId,
				item_id: itemId,
				item_type: itemType,
			},
			{ orderBy: "created_at DESC" },
		);
		return this.runQuery<AppData>(query, values);
	}

	/**
	 * Gets all app data for a user
	 * @param userId - The user ID
	 * @returns The app data
	 */
	public async getAppDataByUser(userId: number): Promise<AppData[]> {
		const { query, values } = this.buildSelectQuery(
			"app_data",
			{ user_id: userId },
			{ orderBy: "created_at DESC" },
		);
		return this.runQuery<AppData>(query, values);
	}

	/**
	 * Updates app data
	 * @param id - The ID of the app data
	 * @param data - The data to update
	 */
	public async updateAppData(
		id: string,
		data: Record<string, any>,
	): Promise<void> {
		const currentData = await this.getAppDataById(id);

		const result = this.buildUpdateQuery(
			"app_data",
			{ data },
			["data"],
			"id = ?",
			[id],
			{ jsonFields: ["data"] },
		);

		if (!result) {
			return;
		}

		const queryWithTimestamp = result.query.replace(
			"updated_at = datetime('now')",
			"updated_at = CURRENT_TIMESTAMP",
		);

		await this.executeRun(queryWithTimestamp, result.values);

		if (this.cache) {
			const itemCacheKey = KVCache.createKey("app-data", id);
			await this.cache.delete(itemCacheKey);

			if (currentData) {
				await this.invalidateUserAppCache(
					currentData.user_id,
					currentData.app_id,
				);
			}
		}
	}

	/**
	 * Deletes app data
	 * @param id - The ID of the app data
	 */
	public async deleteAppData(id: string): Promise<void> {
		const existing = await this.getAppDataById(id);
		const { query, values } = this.buildDeleteQuery("app_data", { id });
		await this.executeRun(query, values);

		if (this.cache && existing) {
			const itemCacheKey = KVCache.createKey("app-data", id);
			await this.cache.delete(itemCacheKey);
			await this.invalidateUserAppCache(existing.user_id, existing.app_id);
		}
	}

	/**
	 * Deletes all app data for a user and specific app
	 * @param userId - The user ID
	 * @param appId - The app ID
	 */
	public async deleteAppDataByUserAndApp(
		userId: number,
		appId: string,
	): Promise<void> {
		const { query, values } = this.buildDeleteQuery("app_data", {
			user_id: userId,
			app_id: appId,
		});
		await this.executeRun(query, values);

		await this.invalidateUserAppCache(userId, appId);
	}

	/**
	 * Deletes all app data for a user, app, and item
	 * @param userId - The user ID
	 * @param appId - The app ID
	 * @param itemId - The item ID
	 * @param itemType - The item type
	 * @returns The deleted app data
	 */
	public async deleteAppDataByUserAppAndItem(
		userId: number,
		appId: string,
		itemId: string,
		itemType?: string,
	): Promise<void> {
		const { query, values } = this.buildDeleteQuery("app_data", {
			user_id: userId,
			app_id: appId,
			item_id: itemId,
			item_type: itemType,
		});
		await this.executeRun(query, values);

		await this.invalidateUserAppCache(userId, appId);
	}

	/**
	 * Updates app data with a share ID
	 * @param id - The ID of the app data
	 * @param shareId - The share ID to set
	 */
	public async updateAppDataWithShareId(
		id: string,
		shareId: string,
	): Promise<void> {
		const result = this.buildUpdateQuery(
			"app_data",
			{ share_id: shareId },
			["share_id"],
			"id = ?",
			[id],
		);

		if (!result) {
			return;
		}

		const queryWithTimestamp = result.query.replace(
			"updated_at = datetime('now')",
			"updated_at = CURRENT_TIMESTAMP",
		);

		await this.executeRun(queryWithTimestamp, result.values);
	}

	/**
	 * Gets app data by share ID
	 * @param shareId - The share ID
	 * @returns The app data
	 */
	public async getAppDataByShareId(shareId: string): Promise<AppData | null> {
		const { query, values } = this.buildSelectQuery("app_data", {
			share_id: shareId,
		});
		return this.runQuery<AppData>(query, values, true);
	}

	/**
	 * Cache invalidation helper
	 */
	private async invalidateUserAppCache(
		userId: number,
		appId: string,
	): Promise<void> {
		if (!this.cache) return;

		const userAppKey = KVCache.createKey(
			"app-data-user-app",
			userId.toString(),
			appId,
		);
		await this.cache.delete(userAppKey);
	}
}
