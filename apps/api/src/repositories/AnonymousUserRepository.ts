import type { AnonymousUser } from "~/types";
import { getLogger } from "~/utils/logger";
import { AssistantError, ErrorType } from "~/utils/errors";
import { BaseRepository } from "./BaseRepository";
import { generateId } from "~/utils/id";

const logger = getLogger({ prefix: "repositories/AnonymousUserRepository" });

export class AnonymousUserRepository extends BaseRepository {
	/**
	 * Hashes an IP address using SHA-256 for privacy using Web Crypto API
	 * @param ipAddress The IP address to hash
	 * @returns Hashed IP address as a hex string
	 */
	private async hashIpAddress(ipAddress: string): Promise<string> {
		const encoder = new TextEncoder();
		const data = encoder.encode(ipAddress);

		const hashBuffer = await crypto.subtle.digest("SHA-256", data);

		const hashArray = Array.from(new Uint8Array(hashBuffer));
		return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
	}

	public async getAnonymousUserById(id: string): Promise<AnonymousUser | null> {
		const { query, values } = this.buildSelectQuery("anonymous_user", { id });
		return this.runQuery<AnonymousUser>(query, values, true);
	}

	public async getAnonymousUserByIp(
		ipAddress: string,
	): Promise<AnonymousUser | null> {
		const hashedIp = await this.hashIpAddress(ipAddress);
		const { query, values } = this.buildSelectQuery("anonymous_user", {
			ip_address: hashedIp,
		});
		return this.runQuery<AnonymousUser>(query, values, true);
	}

	public async createOrUpdateAnonymousUser(
		ipAddress: string,
		userAgent?: string,
		id?: string,
	): Promise<AnonymousUser | null> {
		const userId = id || generateId();
		const now = new Date().toISOString();
		const hashedIp = await this.hashIpAddress(ipAddress);

		const existingUser = await this.getAnonymousUserById(userId);
		if (existingUser) {
			return this.updateAnonymousUser(userId, {
				ip_address: hashedIp,
				user_agent: userAgent,
				last_active_at: now,
			});
		}

		const insert = this.buildInsertQuery(
			"anonymous_user",
			{
				id: userId,
				ip_address: hashedIp,
				user_agent: userAgent || null,
				daily_message_count: 0,
				daily_reset: now,
				created_at: now,
				updated_at: now,
				last_active_at: now,
			},
			{ returning: "*" },
		);

		if (!insert) {
			return null;
		}

		return this.runQuery<AnonymousUser>(insert.query, insert.values, true);
	}

	public async updateAnonymousUser(
		id: string,
		userData: Partial<AnonymousUser>,
	): Promise<AnonymousUser | null> {
		if (!id) {
			return null;
		}

		// Filter out undefined and null values
		const filteredUserData = Object.fromEntries(
			Object.entries(userData).filter(
				([_, value]) => value !== undefined && value !== null,
			),
		) as Partial<AnonymousUser>;

		// Get all field names except 'id'
		const fieldsToUpdate = Object.keys(filteredUserData).filter(
			(key) => key !== "id",
		);

		const result = this.buildUpdateQuery(
			"anonymous_user",
			filteredUserData,
			fieldsToUpdate,
			"id = ?",
			[id],
		);
		if (!result) {
			return null;
		}

		await this.executeRun(result.query, result.values);

		return this.getAnonymousUserById(id);
	}

	public async getOrCreateAnonymousUser(
		ipAddress: string,
		userAgent?: string,
	): Promise<AnonymousUser | null> {
		try {
			const hashedIp = await this.hashIpAddress(ipAddress);

			const deterministicId = hashedIp.substring(0, 36);
			const now = new Date().toISOString();

			try {
				const insert = this.buildInsertQuery("anonymous_user", {
					id: deterministicId,
					ip_address: hashedIp,
					user_agent: userAgent || null,
					daily_message_count: 0,
					daily_reset: now,
					created_at: now,
					updated_at: now,
					last_active_at: now,
				});

				if (!insert) {
					return null;
				}

				await this.executeRun(insert.query, insert.values);

				return this.getAnonymousUserById(deterministicId);
			} catch (insertError) {
				const existingUser = await this.getAnonymousUserById(deterministicId);

				if (existingUser) {
					await this.updateAnonymousUser(existingUser.id, {
						last_active_at: now,
						user_agent: userAgent || existingUser.user_agent,
					});
					return existingUser;
				}

				const ipUser = await this.getAnonymousUserByIp(ipAddress);
				if (ipUser) {
					return ipUser;
				}

				logger.error(
					"Unexpected error in anonymous user creation:",
					insertError,
				);
				return null;
			}
		} catch (error) {
			logger.error("Error in getOrCreateAnonymousUser:", {
				error_message: error instanceof Error ? error.message : "Unknown error",
			});
			throw error;
		}
	}

	public async checkAndResetDailyLimit(
		id: string,
	): Promise<{ count: number; isNewDay: boolean }> {
		if (!id) {
			throw new AssistantError("Invalid ID", ErrorType.PARAMS_ERROR);
		}

		const user = await this.getAnonymousUserById(id);

		if (!user) {
			throw new AssistantError("User not found", ErrorType.NOT_FOUND);
		}

		const now = new Date();
		const lastReset = user.daily_reset ? new Date(user.daily_reset) : null;

		const isNewDay =
			!lastReset ||
			now.getUTCFullYear() !== lastReset.getUTCFullYear() ||
			now.getUTCMonth() !== lastReset.getUTCMonth() ||
			now.getUTCDate() !== lastReset.getUTCDate();

		if (isNewDay) {
			await this.updateAnonymousUser(id, {
				daily_message_count: 0,
				daily_reset: now.toISOString(),
			});
			return { count: 0, isNewDay: true };
		}

		return {
			count: user.daily_message_count || 0,
			isNewDay: false,
		};
	}

	public async incrementDailyCount(id: string): Promise<void> {
		const user = await this.getAnonymousUserById(id);

		if (!user) {
			throw new AssistantError("User not found", ErrorType.NOT_FOUND);
		}

		const now = new Date();
		const { count, isNewDay } = await this.checkAndResetDailyLimit(id);

		await this.updateAnonymousUser(id, {
			daily_message_count: count + 1,
			last_active_at: now.toISOString(),
			...(isNewDay && { daily_reset: now.toISOString() }),
		});
	}
}
