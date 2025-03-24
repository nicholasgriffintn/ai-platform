import type { D1Database } from "@cloudflare/workers-types";

import { Database } from "../../lib/database";
import type { IEnv, User } from "../../types";
import { AssistantError, ErrorType } from "../../utils/errors";

/**
 * Map database result to User type
 */
function mapToUser(
  result: Record<string, unknown>,
  allowedUsernames?: string[],
): User {
  // TODO: Get this from the database when we have plans
  const isProPlan = allowedUsernames?.includes(
    result.github_username as string,
  );

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
    created_at: result.created_at as string,
    updated_at: result.updated_at as string,
    setup_at: result.setup_at as string | null,
    terms_accepted_at: result.terms_accepted_at as string | null,
    plan: isProPlan ? "pro" : "free",
  };
}

/**
 * Get a user by their GitHub user ID
 */
export async function getUserByGithubId(
  db: D1Database,
  githubId: string,
): Promise<User | null> {
  try {
    const database = Database.getInstance(db);
    const result = await database.getUserByGithubId(githubId);

    if (!result) return null;

    return mapToUser(result);
  } catch (error) {
    console.error("Error getting user by GitHub ID:", error);
    throw new AssistantError(
      "Failed to retrieve user",
      ErrorType.UNKNOWN_ERROR,
    );
  }
}

/**
 * Get a user by their session ID
 */
export async function getUserBySessionId(
  env: IEnv,
  sessionId: string,
): Promise<User | null> {
  try {
    const { DB, ALLOWED_USERNAMES } = env;
    const database = Database.getInstance(DB);
    const result = await database.getUserBySessionId(sessionId);

    if (!result) return null;

    const allowedUsernames = ALLOWED_USERNAMES?.split(",");
    return mapToUser(result, allowedUsernames);
  } catch (error) {
    console.error("Error getting user by session ID:", error);
    throw new AssistantError(
      "Failed to retrieve user",
      ErrorType.UNKNOWN_ERROR,
    );
  }
}

/**
 * Get a user by their ID
 */
export async function getUserById(
  db: D1Database,
  userId: number,
): Promise<User | null> {
  try {
    const database = Database.getInstance(db);
    const result = await database.getUserById(userId);

    if (!result) return null;

    return mapToUser(result);
  } catch (error) {
    console.error("Error getting user by ID:", error);
    throw new AssistantError(
      "Failed to retrieve user",
      ErrorType.UNKNOWN_ERROR,
    );
  }
}

/**
 * Create or update a user from GitHub data
 */
export async function createOrUpdateGithubUser(
  db: D1Database,
  userData: {
    githubId: string;
    username: string;
    email: string;
    name?: string;
    avatarUrl?: string;
    company?: string;
    location?: string;
    bio?: string;
    twitterUsername?: string;
    site?: string;
  },
): Promise<User> {
  try {
    const existingUser = await getUserByGithubId(db, userData.githubId);

    const database = Database.getInstance(db);

    if (existingUser) {
      await database.updateUser(existingUser.id, {
        name: userData.name || null,
        avatarUrl: userData.avatarUrl || null,
        email: userData.email,
        username: userData.username,
        company: userData.company || null,
        location: userData.location || null,
        bio: userData.bio || null,
        twitterUsername: userData.twitterUsername || null,
        site: userData.site || null,
      });

      return {
        ...existingUser,
        name: userData.name || existingUser.name,
        avatar_url: userData.avatarUrl || existingUser.avatar_url,
        email: userData.email,
        github_username: userData.username,
        company: userData.company || existingUser.company,
        location: userData.location || existingUser.location,
        bio: userData.bio || existingUser.bio,
        twitter_username:
          userData.twitterUsername || existingUser.twitter_username,
        site: userData.site || existingUser.site,
        updated_at: new Date().toISOString(),
      };
    }

    const userByEmail = (await database.getUserByEmail(
      userData.email,
    )) as User | null;

    if (userByEmail) {
      await database.createOauthAccount(
        userByEmail.id,
        "github",
        userData.githubId,
      );

      await database.updateUserWithGithubData(userByEmail.id, userData);

      return {
        ...userByEmail,
        github_username: userData.username,
        name: userData.name || userByEmail.name,
        avatar_url: userData.avatarUrl || userByEmail.avatar_url,
        company: userData.company || userByEmail.company,
        location: userData.location || userByEmail.location,
        bio: userData.bio || userByEmail.bio,
        twitter_username:
          userData.twitterUsername || userByEmail.twitter_username,
        site: userData.site || userByEmail.site,
        updated_at: new Date().toISOString(),
      };
    }

    const result = await database.createUser(userData);

    if (!result) {
      throw new AssistantError(
        "Failed to create user",
        ErrorType.UNKNOWN_ERROR,
      );
    }

    const newUser = mapToUser(result);

    await database.createOauthAccount(newUser.id, "github", userData.githubId);

    return newUser;
  } catch (error) {
    console.error("Error creating/updating user:", error);
    throw new AssistantError(
      "Failed to create or update user",
      ErrorType.UNKNOWN_ERROR,
    );
  }
}

/**
 * Create a new session for a user
 */
export async function createSession(
  db: D1Database,
  userId: number,
  expiresInDays = 7,
): Promise<string> {
  try {
    const database = Database.getInstance(db);

    const sessionId = crypto.randomUUID();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiresInDays);

    await database.createSession(sessionId, userId, expiresAt);

    return sessionId;
  } catch (error) {
    console.error("Error creating session:", error);
    throw new AssistantError(
      "Failed to create session",
      ErrorType.UNKNOWN_ERROR,
    );
  }
}

/**
 * Delete a session
 */
export async function deleteSession(
  db: D1Database,
  sessionId: string,
): Promise<void> {
  try {
    const database = Database.getInstance(db);
    await database.deleteSession(sessionId);
  } catch (error) {
    console.error("Error deleting session:", error);
    throw new AssistantError(
      "Failed to delete session",
      ErrorType.UNKNOWN_ERROR,
    );
  }
}
