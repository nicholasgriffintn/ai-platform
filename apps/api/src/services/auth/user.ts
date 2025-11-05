import { RepositoryManager } from "~/repositories";
import type { IUserSettings, User } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { getLogger } from "~/utils/logger";
import { generateId } from "~/utils/id";

const logger = getLogger({ prefix: "services/auth/user" });

/**
 * Map database result to User type
 * @param result - The database result
 * @returns The User object
 */
function mapToUser(result: Record<string, unknown>): User {
	return {
		id: result.id as number,
		name: result.name as string | null,
		avatar_url: result.avatar_url as string | null,
		email: result.email as string,
		github_username: result.github_username as string | null,
		company: result.company as string | null,
		site: result.site as string | null,
		location: result.location as string | null,
		bio: result.bio as string | null,
		twitter_username: result.twitter_username as string | null,
		role: result.role as string | null,
		created_at: result.created_at as string,
		updated_at: result.updated_at as string,
		setup_at: result.setup_at as string | null,
		terms_accepted_at: result.terms_accepted_at as string | null,
		plan_id: result.plan_id as string | null,
		message_count: result.message_count as number | undefined,
		daily_message_count: result.daily_message_count as number | undefined,
		daily_reset: result.daily_reset as string | null,
		daily_pro_message_count: result.daily_pro_message_count as
			| number
			| undefined,
		daily_pro_reset: result.daily_pro_reset as string | null,
		last_active_at: result.last_active_at as string | null,
		stripe_customer_id: result.stripe_customer_id as string | null,
		stripe_subscription_id: result.stripe_subscription_id as string | null,
	};
}

/**
 * Get a user by their GitHub user ID
 * @param repositories - The repository manager instance
 * @param githubId - The GitHub user ID
 * @returns The User object or null if the user is not found
 */
export async function getUserByGithubId(
	repositories: RepositoryManager,
	githubId: string,
): Promise<User | null> {
	try {
		const result = await repositories.users.getUserByGithubId(githubId);

		if (!result) return null;

		return mapToUser(result);
	} catch (error) {
		logger.error("Error getting user by GitHub ID:", { error });
		throw new AssistantError(
			"Failed to retrieve user by GitHub ID",
			ErrorType.UNKNOWN_ERROR,
		);
	}
}

/**
 * Get a user by their session ID
 * @param repositories - The repository manager instance
 * @param sessionId - The session ID
 * @returns The User object or null if the user is not found
 */
export async function getUserBySessionId(
	repositories: RepositoryManager,
	sessionId: string,
): Promise<User | null> {
	try {
		const result = await repositories.users.getUserBySessionId(sessionId);

		if (!result) return null;

		return mapToUser(result);
	} catch (error) {
		logger.error("Error getting user by session ID:", { error });
		throw new AssistantError(
			"Failed to retrieve user by session ID",
			ErrorType.UNKNOWN_ERROR,
		);
	}
}

/**
 * Get a user's settings
 * @param repositories - The repository manager instance
 * @param userId - The user ID
 * @returns The user settings or null if the user is not found
 */
export async function getUserSettings(
	repositories: RepositoryManager,
	userId: number,
): Promise<IUserSettings | null> {
	try {
		if (!userId) {
			return null;
		}

		const result = await repositories.userSettings.getUserSettings(userId);
		return result;
	} catch (error) {
		logger.error("Error getting user settings:", { error });
		throw new AssistantError(
			"Failed to retrieve user settings",
			ErrorType.UNKNOWN_ERROR,
		);
	}
}

/**
 * Get a user by their ID
 * @param repositories - The repository manager instance
 * @param userId - The user ID
 * @returns The User object or null if the user is not found
 */
export async function getUserById(
	repositories: RepositoryManager,
	userId: number,
): Promise<User | null> {
	try {
		const result = await repositories.users.getUserById(userId);

		if (!result) return null;

		return result as unknown as User | null;
	} catch (error) {
		logger.error("Error getting user by ID:", { error });
		throw new AssistantError(
			"Failed to retrieve user by ID",
			ErrorType.UNKNOWN_ERROR,
		);
	}
}

export async function createUserSettings(
	repositories: RepositoryManager,
	userId: number,
) {
	const result = await repositories.userSettings.createUserSettings(userId);
	return result;
}

export async function createUserProviderSettings(
	repositories: RepositoryManager,
	userId: number,
) {
	const result =
		await repositories.userSettings.createUserProviderSettings(userId);
	return result;
}

/**
 * Create or update a user from GitHub data
 * @param repositories - The repository manager instance
 * @param userData - The user data
 * @returns The User object
 */
export async function createOrUpdateGithubUser(
	repositories: RepositoryManager,
	userData: {
		githubId: string;
		username: string;
		email: string;
		name?: string;
		avatar_url?: string;
		company?: string;
		location?: string;
		bio?: string;
		twitter_username?: string;
		site?: string;
	},
): Promise<User> {
	try {
		const existingUser = await getUserByGithubId(repositories, userData.githubId);

		if (existingUser) {
			await repositories.users.updateUser(existingUser.id, {
				name: userData.name || null,
				avatar_url: userData.avatar_url || null,
				email: userData.email,
				github_username: userData.username,
				company: userData.company || null,
				location: userData.location || null,
				bio: userData.bio || null,
				twitter_username: userData.twitter_username || null,
				site: userData.site || null,
			});

			return {
				...existingUser,
				name: userData.name || existingUser.name,
				avatar_url: userData.avatar_url || existingUser.avatar_url,
				email: userData.email,
				github_username: userData.username,
				company: userData.company || existingUser.company,
				location: userData.location || existingUser.location,
				bio: userData.bio || existingUser.bio,
				twitter_username:
					userData.twitter_username || existingUser.twitter_username,
				site: userData.site || existingUser.site,
				updated_at: new Date().toISOString(),
			};
		}

		const userByEmail = await repositories.users.getUserByEmail(userData.email);

		if (userByEmail) {
			await repositories.users.createOauthAccount(
				userByEmail.id as number,
				"github",
				userData.githubId,
			);

			await repositories.users.updateUserWithGithubData(
				userByEmail.id as number,
				userData,
			);

			return {
				...(userByEmail as unknown as User),
				github_username: userData.username,
				name: userData.name || userByEmail.name,
				avatar_url: userData.avatar_url || userByEmail.avatar_url,
				company: userData.company || userByEmail.company,
				location: userData.location || userByEmail.location,
				bio: userData.bio || userByEmail.bio,
				twitter_username:
					userData.twitter_username || userByEmail.twitter_username,
				site: userData.site || userByEmail.site,
				updated_at: new Date().toISOString(),
			} as User;
		}

		const result = await repositories.users.createUser(userData);

		if (!result) {
			throw new AssistantError(
				"Failed to create user",
				ErrorType.UNKNOWN_ERROR,
			);
		}

		// Create user settings
		if ("id" in result) {
			try {
				await repositories.userSettings.createUserSettings(result.id as number);
			} catch (settingsError) {
				logger.error("Failed to create user settings:", { settingsError });
			}

			try {
				await repositories.userSettings.createUserProviderSettings(
					result.id as number,
				);
			} catch (providerSettingsError) {
				logger.error("Failed to create user provider settings:", {
					providerSettingsError,
				});
			}
		}

		const newUser = mapToUser(result);

		await repositories.users.createOauthAccount(
			newUser.id,
			"github",
			userData.githubId,
		);

		return newUser;
	} catch (error) {
		logger.error("Error creating/updating user:", { error });
		throw new AssistantError(
			"Failed to create or update user",
			ErrorType.UNKNOWN_ERROR,
		);
	}
}

/**
 * Create a new session for a user
 * @param repositories - The repository manager instance
 * @param userId - The user ID
 * @param expiresInDays - The number of days the session will expire
 * @returns The session ID
 */
export async function createSession(
	repositories: RepositoryManager,
	userId: number,
	expiresInDays = 7,
): Promise<string> {
	try {
		const sessionId = generateId();
		const expiresAt = new Date();
		expiresAt.setDate(expiresAt.getDate() + expiresInDays);

		await repositories.sessions.createSession(sessionId, userId, expiresAt);

		return sessionId;
	} catch (error) {
		logger.error("Error creating session:", { error });
		throw new AssistantError(
			"Failed to create session",
			ErrorType.UNKNOWN_ERROR,
		);
	}
}

/**
 * Delete a session
 * @param repositories - The repository manager instance
 * @param sessionId - The session ID
 */
export async function deleteSession(
	repositories: RepositoryManager,
	sessionId: string,
): Promise<void> {
	try {
		await repositories.sessions.deleteSession(sessionId);
	} catch (error) {
		logger.error("Error deleting session:", { error });
		throw new AssistantError(
			"Failed to delete session",
			ErrorType.UNKNOWN_ERROR,
		);
	}
}
