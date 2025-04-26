import type { AnonymousUser } from "~/types";
import { BaseRepository } from "./BaseRepository";

export class AnonymousUserRepository extends BaseRepository {
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
    return this.runQuery<AnonymousUser>(
      "SELECT * FROM anonymous_user WHERE ip_address = ?",
      [ipAddress],
      true,
    );
  }

  public async createAnonymousUser(
    ipAddress: string,
    userAgent?: string,
    id?: string,
  ): Promise<AnonymousUser | null> {
    const userId = id || crypto.randomUUID();
    const now = new Date().toISOString();

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
      [userId, ipAddress, userAgent || null, 0, now, now, now, now],
      true,
    );
  }

  public async updateAnonymousUser(
    id: string,
    userData: Partial<AnonymousUser>,
  ): Promise<void> {
    if (!id) {
      return;
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
      return;
    }

    const setClause = fieldsToUpdate.map((key) => `${key} = ?`).join(", ");
    const values = fieldsToUpdate.map(
      (key) => filteredUserData[key as keyof typeof filteredUserData],
    );

    const query = `UPDATE anonymous_user SET ${setClause}, updated_at = datetime('now') WHERE id = ?`;
    const finalValues = [...values, id];

    await this.executeRun(query, finalValues);
  }

  public async getOrCreateAnonymousUser(
    ipAddress: string,
    userAgent?: string,
  ): Promise<AnonymousUser | null> {
    const existingUser = await this.getAnonymousUserByIp(ipAddress);

    if (existingUser) {
      return existingUser;
    }

    return this.createAnonymousUser(ipAddress, userAgent);
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
