import type { User } from "~/types";
import { BaseRepository } from "./BaseRepository";

export class UserRepository extends BaseRepository {
  public async getUserByGithubId(
    githubId: string,
  ): Promise<Record<string, unknown> | null> {
    const result = this.runQuery<Record<string, unknown>>(
      `SELECT u.* FROM user u
       JOIN oauth_account oa ON u.id = oa.user_id
       WHERE oa.provider_id = 'github' AND oa.provider_user_id = ?`,
      [githubId],
      true,
    );
    return result;
  }

  public async getUserBySessionId(
    sessionId: string,
  ): Promise<Record<string, unknown> | null> {
    const result = this.runQuery<Record<string, unknown>>(
      `SELECT u.* FROM user u
       JOIN session s ON u.id = s.user_id
       WHERE s.id = ? AND s.expires_at > datetime('now')`,
      [sessionId],
      true,
    );
    return result;
  }

  public async getUserById(userId: number): Promise<User | null> {
    const result = this.runQuery<User>(
      "SELECT * FROM user WHERE id = ?",
      [userId],
      true,
    );
    return result;
  }

  public async getUserByEmail(email: string): Promise<User | null> {
    const result = this.runQuery<User>(
      "SELECT * FROM user WHERE email = ?",
      [email],
      true,
    );
    return result;
  }

  public async updateUser(
    userId: number,
    userData: Record<string, unknown>,
  ): Promise<void> {
    const fieldsToUpdate = Object.keys(userData).filter(
      (key) =>
        key !== "id" && userData[key as keyof typeof userData] !== undefined,
    );

    if (fieldsToUpdate.length === 0) {
      return;
    }

    const setClause = fieldsToUpdate.map((key) => `${key} = ?`).join(", ");
    const values = fieldsToUpdate.map(
      (key) => userData[key as keyof typeof userData],
    );

    const query = `UPDATE user SET ${setClause}, updated_at = datetime('now') WHERE id = ?`;
    const finalValues = [...values, userId];

    await this.executeRun(query, finalValues);
  }

  public async createUser(
    userData: Record<string, unknown>,
  ): Promise<Record<string, unknown> | null> {
    const result = this.runQuery<Record<string, unknown>>(
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
    _providerId: string,
    providerUserId: string,
  ): Promise<void> {
    await this.executeRun(
      `INSERT INTO oauth_account (provider_id, provider_user_id, user_id)
       VALUES ('github', ?, ?)`,
      [providerUserId, userId],
    );
  }

  public async getUserByStripeCustomerId(
    customerId: string,
  ): Promise<User | null> {
    const result = this.runQuery<User>(
      "SELECT * FROM user WHERE stripe_customer_id = ?",
      [customerId],
      true,
    );
    return result;
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
    // Check if user exists by GitHub ID
    const existingUser = await this.getUserByGithubId(userData.githubId);

    if (existingUser) {
      // Update existing user
      await this.updateUser((existingUser as any).id, {
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

      // Get updated user
      const updatedUser = await this.getUserById((existingUser as any).id);
      if (!updatedUser) {
        throw new Error("Failed to retrieve updated user");
      }

      return updatedUser;
    }

    // Check if user exists by email
    const userByEmail = await this.getUserByEmail(userData.email);

    if (userByEmail) {
      // Link GitHub account to existing user
      await this.createOauthAccount(
        userByEmail.id,
        "github",
        userData.githubId,
      );

      // Update user with GitHub data
      await this.updateUserWithGithubData(userByEmail.id, userData);

      // Get updated user
      const updatedUser = await this.getUserById(userByEmail.id);
      if (!updatedUser) {
        throw new Error("Failed to retrieve updated user");
      }

      return updatedUser;
    }

    // Create new user
    const result = await this.createUser(userData);

    if (!result) {
      throw new Error("Failed to create user");
    }

    // Link GitHub account to new user
    await this.createOauthAccount(
      (result as any).id,
      "github",
      userData.githubId,
    );

    // Get created user
    const newUser = await this.getUserById((result as any).id);
    if (!newUser) {
      throw new Error("Failed to retrieve created user");
    }

    return newUser;
  }
}
