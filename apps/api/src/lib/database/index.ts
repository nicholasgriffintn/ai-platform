import type { D1Database } from "@cloudflare/workers-types";

import { RepositoryManager } from "~/repositories";
import type { IEnv } from "~/types";
import { logError } from "~/utils/errorLogger";
import { AssistantError, ErrorType } from "~/utils/errors";
import { getLogger } from "~/utils/logger";

export * as schema from "./schema";

export interface Env {
	DB: D1Database;
}

const logger = getLogger({ prefix: "lib/database" });

/**
 * Database class - lightweight wrapper around RepositoryManager
 * Provides access to repositories and database connection
 * Most database operations should be done through repositories directly via ServiceContext
 */
export class Database {
	private _repositories: RepositoryManager;
	private env: IEnv;

	constructor(env: IEnv) {
		if (!env?.DB) {
			throw new AssistantError(
				"Database not configured",
				ErrorType.CONFIGURATION_ERROR,
			);
		}
		this.env = env;
		this._repositories = new RepositoryManager(env);
	}

	public static getInstance(env: IEnv): Database {
		return new Database(env);
	}

	/**
	 * Get the repository manager for direct repository access
	 * Prefer using context.repositories in services
	 */
	public get repositories(): RepositoryManager {
		return this._repositories;
	}

	public get connection(): D1Database {
		return this.env.DB;
	}

	public async createUser(
		userData: Record<string, unknown>,
	): Promise<Record<string, unknown> | null> {
		try {
			const user = await this._repositories.users.createUser(userData);

			if (user && "id" in user) {
				try {
					await this._repositories.userSettings.createUserSettings(
						user.id as number,
					);
				} catch (settingsError) {
					logError(
						"Failed to create user settings during user creation",
						settingsError,
						{
							operation: "createUserSettings",
						},
					);
				}

				try {
					await this._repositories.userSettings.createUserProviderSettings(
						user.id as number,
					);
				} catch (providerSettingsError) {
					logError(
						"Failed to create user provider settings during user creation",
						providerSettingsError,
						{
							operation: "createUserProviderSettings",
						},
					);
				}
			}

			return user;
		} catch (error) {
			logError("Failed to create user", error, {
				operation: "createUser",
				userData: { ...userData, password: "REDACTED" },
			});

			throw new AssistantError(
				"Unable to create user account",
				ErrorType.DATABASE_ERROR,
				500,
			);
		}
	}

	public async consumeMagicLinkNonce(
		nonce: string,
		userId: number,
	): Promise<boolean> {
		try {
			const foundNonce = await this._repositories.magicLinkNonces.findNonce(
				nonce,
				userId,
			);

			if (!foundNonce) {
				return false;
			}

			await this._repositories.magicLinkNonces.deleteNonce(nonce);
			return true;
		} catch (error) {
			logger.error(`Error consuming nonce ${nonce}:`, { error });
			return false;
		}
	}

	public async deleteAllChatCompletions(userId: number): Promise<void> {
		try {
			const allConversations =
				await this._repositories.conversations.getUserConversations(
					userId,
					1000,
					1,
					false,
				);

			if (allConversations.conversations.length === 0) {
				return;
			}

			for (const conversation of allConversations.conversations) {
				if (!conversation.id || typeof conversation.id !== "string") {
					continue;
				}
				await this._repositories.messages.deleteAllMessages(conversation.id);
				await this._repositories.conversations.deleteConversation(
					conversation.id,
				);
			}

			return;
		} catch (error) {
			logger.error(`Error deleting all chat completions: ${error}`);
		}
	}
}
