import { generateId } from "~/utils/id";
import { BaseRepository } from "./BaseRepository";

export interface AppData {
  id: string;
  user_id: number;
  app_id: string;
  item_id?: string;
  item_type?: string;
  data: string;
  created_at: string;
  updated_at: string;
}

export class AppDataRepository extends BaseRepository {
  /**
   * Creates a new app data entry
   */
  public async createAppData(
    userId: number,
    appId: string,
    data: Record<string, any>,
  ): Promise<AppData> {
    const id = generateId();

    await this.executeRun(
      "INSERT INTO app_data (id, user_id, app_id, data) VALUES (?, ?, ?, ?)",
      [id, userId, appId, JSON.stringify(data)],
    );

    return {
      id,
      user_id: userId,
      app_id: appId,
      data: JSON.stringify(data),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }

  /**
   * Creates a new app data entry with item_id and item_type
   */
  public async createAppDataWithItem(
    userId: number,
    appId: string,
    itemId: string,
    itemType: string,
    data: Record<string, any>,
  ): Promise<AppData> {
    const id = generateId();

    await this.executeRun(
      "INSERT INTO app_data (id, user_id, app_id, item_id, item_type, data) VALUES (?, ?, ?, ?, ?, ?)",
      [id, userId, appId, itemId, itemType, JSON.stringify(data)],
    );

    return {
      id,
      user_id: userId,
      app_id: appId,
      item_id: itemId,
      item_type: itemType,
      data: JSON.stringify(data),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }

  /**
   * Gets app data by id
   */
  public async getAppDataById(id: string): Promise<AppData | null> {
    return this.runQuery<AppData>(
      "SELECT * FROM app_data WHERE id = ?",
      [id],
      true,
    );
  }

  /**
   * Gets all app data for a user and specific app
   */
  public async getAppDataByUserAndApp(
    userId: number,
    appId: string,
  ): Promise<AppData[]> {
    return this.runQuery<AppData>(
      "SELECT * FROM app_data WHERE user_id = ? AND app_id = ? ORDER BY created_at DESC",
      [userId, appId],
    );
  }

  /**
   * Gets all app data for a user, app, item_id and optionally item_type
   */
  public async getAppDataByUserAppAndItem(
    userId: number,
    appId: string,
    itemId: string,
    itemType?: string,
  ): Promise<AppData[]> {
    if (itemType) {
      return this.runQuery<AppData>(
        "SELECT * FROM app_data WHERE user_id = ? AND app_id = ? AND item_id = ? AND item_type = ? ORDER BY created_at DESC",
        [userId, appId, itemId, itemType],
      );
    }

    return this.runQuery<AppData>(
      "SELECT * FROM app_data WHERE user_id = ? AND app_id = ? AND item_id = ? ORDER BY created_at DESC",
      [userId, appId, itemId],
    );
  }

  /**
   * Gets all app data for a user
   */
  public async getAppDataByUser(userId: number): Promise<AppData[]> {
    return this.runQuery<AppData>(
      "SELECT * FROM app_data WHERE user_id = ? ORDER BY created_at DESC",
      [userId],
    );
  }

  /**
   * Updates app data
   */
  public async updateAppData(
    id: string,
    data: Record<string, any>,
  ): Promise<void> {
    await this.executeRun(
      "UPDATE app_data SET data = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      [JSON.stringify(data), id],
    );
  }

  /**
   * Deletes app data
   */
  public async deleteAppData(id: string): Promise<void> {
    await this.executeRun("DELETE FROM app_data WHERE id = ?", [id]);
  }

  /**
   * Deletes all app data for a user and specific app
   */
  public async deleteAppDataByUserAndApp(
    userId: number,
    appId: string,
  ): Promise<void> {
    await this.executeRun(
      "DELETE FROM app_data WHERE user_id = ? AND app_id = ?",
      [userId, appId],
    );
  }

  /**
   * Deletes all app data for a user, app, and item
   */
  public async deleteAppDataByUserAppAndItem(
    userId: number,
    appId: string,
    itemId: string,
    itemType?: string,
  ): Promise<void> {
    if (itemType) {
      await this.executeRun(
        "DELETE FROM app_data WHERE user_id = ? AND app_id = ? AND item_id = ? AND item_type = ?",
        [userId, appId, itemId, itemType],
      );
      return;
    }

    await this.executeRun(
      "DELETE FROM app_data WHERE user_id = ? AND app_id = ? AND item_id = ?",
      [userId, appId, itemId],
    );
  }
}
