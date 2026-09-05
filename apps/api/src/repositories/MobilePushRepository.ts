import type { RegisterMobilePushDevice } from "@ngriffin_uk/polychat-schemas";

import { generateId } from "~/utils/id";

import { BaseRepository } from "./BaseRepository";

export interface MobilePushDeviceRecord {
  id: string;
  user_id: number;
  token: string;
  environment: "sandbox" | "production";
  app_bundle_id: string;
  last_registered_at: string;
  invalidated_at: string | null;
  created_at: string;
}

export class MobilePushRepository extends BaseRepository {
  async register(userId: number, input: RegisterMobilePushDevice): Promise<void> {
    await this.executeRun(
      `INSERT INTO mobile_push_device (
         id, user_id, token, environment, app_bundle_id, last_registered_at, invalidated_at
       ) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, NULL)
       ON CONFLICT(token) DO UPDATE SET
         user_id = excluded.user_id,
         environment = excluded.environment,
         app_bundle_id = excluded.app_bundle_id,
         last_registered_at = CURRENT_TIMESTAMP,
         invalidated_at = NULL`,
      [generateId(), userId, input.token.toLowerCase(), input.environment, input.appBundleId],
    );
  }

  async unregister(userId: number, token: string): Promise<void> {
    await this.executeRun("DELETE FROM mobile_push_device WHERE user_id = ? AND token = ?", [
      userId,
      token.toLowerCase(),
    ]);
  }

  async listActiveForUser(userId: number): Promise<MobilePushDeviceRecord[]> {
    return this.runQuery<MobilePushDeviceRecord>(
      `SELECT * FROM mobile_push_device
       WHERE user_id = ? AND invalidated_at IS NULL
       ORDER BY last_registered_at DESC`,
      [userId],
    );
  }

  async claimDelivery(deliveryId: string, deviceId: string): Promise<boolean> {
    const result = await this.executeRun(
      `INSERT INTO mobile_push_delivery (id, device_id, status)
       VALUES (?, ?, 'sending')
       ON CONFLICT(id) DO UPDATE SET status = 'sending', error_code = NULL,
         updated_at = CURRENT_TIMESTAMP
       WHERE mobile_push_delivery.status = 'failed'`,
      [deliveryId, deviceId],
    );

    return Boolean(result.meta?.changes);
  }

  async finishDelivery(
    deliveryId: string,
    status: "sent" | "failed",
    errorCode?: string,
  ): Promise<void> {
    await this.executeRun(
      `UPDATE mobile_push_delivery
       SET status = ?, error_code = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [status, errorCode ?? null, deliveryId],
    );
  }

  async invalidateDevice(deviceId: string): Promise<void> {
    await this.executeRun(
      "UPDATE mobile_push_device SET invalidated_at = CURRENT_TIMESTAMP WHERE id = ?",
      [deviceId],
    );
  }
}
