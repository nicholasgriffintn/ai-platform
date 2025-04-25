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
    // Note: userData.username is used for github_username in the database
    // This method expects the username field from input data and maps it to github_username in DB
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
    providerId: string,
    providerUserId: string,
  ): Promise<void> {
    await this.executeRun(
      `INSERT INTO oauth_account (provider_id, provider_user_id, user_id)
       VALUES ('github', ?, ?)`,
      [providerUserId, userId],
    );
  }
}
