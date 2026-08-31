import type { User } from "~/types";
import { formatUtcDateKey } from "~/utils/date";

import { BaseRepository } from "./BaseRepository";

export type CumulativeUsageCounter = "message_count";

export type DailyUsageCounter = "daily_message_count";

export type UsageCounterIncrements = Partial<
  Record<CumulativeUsageCounter | DailyUsageCounter, number>
>;

const CUMULATIVE_USAGE_COUNTERS: readonly CumulativeUsageCounter[] = ["message_count"];

const DAILY_USAGE_COUNTERS: readonly (readonly [DailyUsageCounter, string])[] = [
  ["daily_message_count", "daily_reset"],
];

export class UserRepository extends BaseRepository {
  public async getUserByOauthAccount(
    providerId: string,
    providerUserId: string,
  ): Promise<User | null> {
    const result = this.runQuery<User>(
      `SELECT u.* FROM user u
       JOIN oauth_account oa ON u.id = oa.user_id
       WHERE oa.provider_id = ? AND oa.provider_user_id = ?`,
      [providerId, providerUserId],
      true,
    );

    return result;
  }

  public async getUserByGithubId(githubId: string): Promise<User | null> {
    return this.getUserByOauthAccount("github", githubId);
  }

  public async getUserBySessionId(sessionId: string): Promise<User | null> {
    const result = this.runQuery<User>(
      `SELECT u.* FROM user u
       JOIN session s ON u.id = s.user_id
       WHERE s.id = ? AND s.expires_at > datetime('now')`,
      [sessionId],
      true,
    );

    return result;
  }

  public async getUserById(userId: number): Promise<User | null> {
    const { query, values } = this.buildSelectQuery("user", { id: userId });

    return this.runQuery<User>(query, values, true);
  }

  public async getUserByEmail(email: string): Promise<User | null> {
    const { query, values } = this.buildSelectQuery("user", { email });

    return this.runQuery<User>(query, values, true);
  }

  public async updateUser(userId: number, userData: Record<string, unknown>): Promise<void> {
    const fieldsToUpdate = Object.keys(userData).filter((key) => key !== "id");

    const result = this.buildUpdateQuery("user", userData, fieldsToUpdate, "id = ?", [userId]);

    if (!result) {
      return;
    }

    await this.executeRun(result.query, result.values);
  }

  public async incrementUsageCounters(
    userId: number,
    increments: UsageCounterIncrements,
    occurredAt: Date = new Date(),
  ): Promise<User | null> {
    const assignments: string[] = [];
    const values: unknown[] = [];
    const day = formatUtcDateKey(occurredAt);
    const timestamp = occurredAt.toISOString();

    for (const counter of CUMULATIVE_USAGE_COUNTERS) {
      const amount = increments[counter];

      if (!amount) {
        continue;
      }

      assignments.push(`${counter} = COALESCE(${counter}, 0) + ?`);
      values.push(amount);
    }

    for (const [counter, resetColumn] of DAILY_USAGE_COUNTERS) {
      const amount = increments[counter];

      if (!amount) {
        continue;
      }

      assignments.push(
        `${counter} = CASE WHEN date(${resetColumn}) = ? THEN COALESCE(${counter}, 0) + ? ELSE ? END`,
      );
      values.push(day, amount, amount);
      assignments.push(
        `${resetColumn} = CASE WHEN date(${resetColumn}) = ? THEN ${resetColumn} ELSE ? END`,
      );
      values.push(day, timestamp);
    }

    if (assignments.length === 0) {
      return this.getUserById(userId);
    }

    assignments.push("last_active_at = ?", "updated_at = datetime('now')");
    values.push(timestamp, userId);

    return this.runQuery<User>(
      `UPDATE user SET ${assignments.join(", ")} WHERE id = ? RETURNING *`,
      values,
      true,
    );
  }

  public async createUser(userData: Record<string, unknown>): Promise<User | null> {
    const result = this.runQuery<User>(
      `INSERT INTO user (
         name, 
         avatar_url, 
         email, 
         github_username,
         company,
         location,
         bio,
         twitter_username,
         site,
         created_at, 
         updated_at
       ) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
       RETURNING *`,
      [
        userData.name || null,
        userData.avatar_url || null,
        userData.email,
        userData.username || null,
        userData.company || null,
        userData.location || null,
        userData.bio || null,
        userData.twitter_username || null,
        userData.site || null,
      ],
      true,
    );

    return result;
  }

  public async updateUserWithGithubData(
    userId: number,
    userData: Record<string, unknown>,
  ): Promise<void> {
    await this.executeRun(
      `UPDATE user 
       SET 
         github_username = ?,
         name = COALESCE(?, name),
         avatar_url = COALESCE(?, avatar_url),
         company = COALESCE(?, company),
         location = COALESCE(?, location),
         bio = COALESCE(?, bio),
         twitter_username = COALESCE(?, twitter_username),
         site = COALESCE(?, site),
         updated_at = datetime('now')
       WHERE id = ?`,
      [
        userData.username,
        userData.name || null,
        userData.avatar_url || null,
        userData.company || null,
        userData.location || null,
        userData.bio || null,
        userData.twitter_username || null,
        userData.site || null,
        userId,
      ],
    );
  }

  public async createOauthAccount(
    userId: number,
    providerId: string,
    providerUserId: string,
  ): Promise<void> {
    await this.executeRun(
      `INSERT INTO oauth_account (provider_id, provider_user_id, user_id)
       VALUES (?, ?, ?)`,
      [providerId, providerUserId, userId],
    );
  }

  public async getUserByStripeCustomerId(customerId: string): Promise<User | null> {
    const { query, values } = this.buildSelectQuery("user", {
      stripe_customer_id: customerId,
    });

    return this.runQuery<User>(query, values, true);
  }

  public async createOrUpdateGithubUser(userData: {
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
  }): Promise<User> {
    const existingUser = await this.getUserByGithubId(userData.githubId);

    if (existingUser) {
      await this.updateUser(existingUser.id, {
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

      const updatedUser = await this.getUserById(existingUser.id);

      if (!updatedUser) {
        throw new Error("Failed to retrieve updated user");
      }

      return updatedUser;
    }

    const userByEmail = await this.getUserByEmail(userData.email);

    if (userByEmail) {
      await this.createOauthAccount(userByEmail.id, "github", userData.githubId);

      await this.updateUserWithGithubData(userByEmail.id, userData);

      const updatedUser = await this.getUserById(userByEmail.id);

      if (!updatedUser) {
        throw new Error("Failed to retrieve updated user");
      }

      return updatedUser;
    }

    const result = await this.createUser(userData);

    if (!result) {
      throw new Error("Failed to create user");
    }

    await this.createOauthAccount(result.id, "github", userData.githubId);

    const newUser = await this.getUserById(result.id);

    if (!newUser) {
      throw new Error("Failed to retrieve created user");
    }

    return newUser;
  }
}
