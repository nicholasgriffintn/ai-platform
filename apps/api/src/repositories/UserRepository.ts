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
    await this.executeRun(
      `UPDATE user 
       SET 
         name = ?, 
         avatar_url = ?, 
         email = ?, 
         github_username = ?,
         company = ?,
         location = ?,
         bio = ?,
         twitter_username = ?,
         site = ?,
         updated_at = datetime('now')
       WHERE id = ?`,
      [
        userData.name || null,
        userData.avatarUrl || null,
        userData.email,
        userData.username,
        userData.company || null,
        userData.location || null,
        userData.bio || null,
        userData.twitterUsername || null,
        userData.site || null,
        userId,
      ],
    );
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
        userData.avatarUrl || null,
        userData.email,
        userData.username || null,
        userData.company || null,
        userData.location || null,
        userData.bio || null,
        userData.twitterUsername || null,
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
        userData.avatarUrl || null,
        userData.company || null,
        userData.location || null,
        userData.bio || null,
        userData.twitterUsername || null,
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
      [providerId, providerUserId, userId],
    );
  }
}
