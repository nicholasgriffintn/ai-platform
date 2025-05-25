import type { AnonymousUser } from "~/types";
import { BaseRepository } from "./BaseRepository";

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
    return this.runQuery<AnonymousUser>(
      "SELECT * FROM anonymous_user WHERE id = ?",
      [id],
      true,
    );
  }

  public async getAnonymousUserByIp(
    ipAddress: string,
  ): Promise<AnonymousUser | null> {
    const hashedIp = await this.hashIpAddress(ipAddress);
    return this.runQuery<AnonymousUser>(
      "SELECT * FROM anonymous_user WHERE ip_address = ?",
      [hashedIp],
      true,
    );
  }

  public async createOrUpdateAnonymousUser(
    ipAddress: string,
    userAgent?: string,
    id?: string,
  ): Promise<AnonymousUser | null> {
    const userId = id || crypto.randomUUID();
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

    return this.runQuery<AnonymousUser>(
      `INSERT INTO anonymous_user (
        id,
        ip_address,
        user_agent,
        daily_message_count,
        daily_reset,
        created_at,
        updated_at,
        last_active_at
      ) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      RETURNING *`,
      [userId, hashedIp, userAgent || null, 0, now, now, now, now],
      true,
    );
  }

  public async updateAnonymousUser(
    id: string,
    userData: Partial<AnonymousUser>,
  ): Promise<AnonymousUser | null> {
    if (!id) {
      return null;
    }

    const filteredUserData = Object.fromEntries(
      Object.entries(userData).filter(
        ([_, value]) => value !== undefined && value !== null,
      ),
    ) as Partial<AnonymousUser>;

    const fieldsToUpdate = Object.keys(filteredUserData).filter(
      (key) => key !== "id",
    );

    if (fieldsToUpdate.length === 0) {
      return null;
    }

    const setClause = fieldsToUpdate.map((key) => `${key} = ?`).join(", ");
    const values = fieldsToUpdate.map(
      (key) => filteredUserData[key as keyof typeof filteredUserData],
    );

    const query = `UPDATE anonymous_user SET ${setClause}, updated_at = datetime('now') WHERE id = ?`;
    const finalValues = [...values, id];

    await this.executeRun(query, finalValues);

    return this.getAnonymousUserById(id);
  }

  public async getOrCreateAnonymousUser(
    ipAddress: string,
    userAgent?: string,
  ): Promise<AnonymousUser | null> {
    try {
      let existingUser = null;

      if (!existingUser) {
        existingUser = await this.getAnonymousUserByIp(ipAddress);
      }

      if (existingUser) {
        return existingUser;
      }

      return this.createOrUpdateAnonymousUser(ipAddress, userAgent);
    } catch (error) {
      console.error("Error in getOrCreateAnonymousUser:", error);
      throw error;
    }
  }

  public async checkAndResetDailyLimit(
    id: string,
  ): Promise<{ count: number; isNewDay: boolean }> {
    if (!id) {
      throw new Error("Invalid ID");
    }

    const user = await this.getAnonymousUserById(id);

    if (!user) {
      throw new Error("User not found");
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
      throw new Error("User not found");
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
