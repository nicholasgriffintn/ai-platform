import { and, eq, gt, lt } from "drizzle-orm";

import { BaseRepository } from "~/infrastructure/database/BaseRepository";
import { deviceAuthorization, type DeviceAuthorizationRow } from "~/infrastructure/database/schema";

export class DeviceAuthorizationRepository extends BaseRepository {
  public async create(record: {
    deviceCodeHash: string;
    userCode: string;
    clientName: string;
    intervalSeconds: number;
    createdAt: string;
    expiresAt: string;
  }): Promise<void> {
    await this.database
      .delete(deviceAuthorization)
      .where(lt(deviceAuthorization.expires_at, record.createdAt));
    await this.database.insert(deviceAuthorization).values({
      device_code_hash: record.deviceCodeHash,
      user_code: record.userCode,
      client_name: record.clientName,
      interval_seconds: record.intervalSeconds,
      created_at: record.createdAt,
      expires_at: record.expiresAt,
    });
  }

  public async findByDeviceCodeHash(deviceCodeHash: string): Promise<DeviceAuthorizationRow | null> {
    const [row] = await this.database
      .select()
      .from(deviceAuthorization)
      .where(eq(deviceAuthorization.device_code_hash, deviceCodeHash))
      .limit(1);

    return row ?? null;
  }

  public async findPendingByUserCode(
    userCode: string,
    now: string,
  ): Promise<DeviceAuthorizationRow | null> {
    const [row] = await this.database
      .select()
      .from(deviceAuthorization)
      .where(
        and(
          eq(deviceAuthorization.user_code, userCode),
          eq(deviceAuthorization.status, "pending"),
          gt(deviceAuthorization.expires_at, now),
        ),
      )
      .limit(1);

    return row ?? null;
  }

  public async recordPoll(
    deviceCodeHash: string,
    polledAt: string,
    intervalSeconds: number,
  ): Promise<void> {
    await this.database
      .update(deviceAuthorization)
      .set({ last_polled_at: polledAt, interval_seconds: intervalSeconds })
      .where(eq(deviceAuthorization.device_code_hash, deviceCodeHash));
  }

  public async decide(params: {
    userCode: string;
    userId: number;
    status: "approved" | "denied";
    decidedAt: string;
  }): Promise<DeviceAuthorizationRow | null> {
    const [row] = await this.database
      .update(deviceAuthorization)
      .set({ status: params.status, user_id: params.userId, decided_at: params.decidedAt })
      .where(
        and(
          eq(deviceAuthorization.user_code, params.userCode),
          eq(deviceAuthorization.status, "pending"),
          gt(deviceAuthorization.expires_at, params.decidedAt),
        ),
      )
      .returning();

    return row ?? null;
  }

  public async consumeApproved(
    deviceCodeHash: string,
    now: string,
  ): Promise<DeviceAuthorizationRow | null> {
    const [row] = await this.database
      .update(deviceAuthorization)
      .set({ status: "consumed", last_polled_at: now })
      .where(
        and(
          eq(deviceAuthorization.device_code_hash, deviceCodeHash),
          eq(deviceAuthorization.status, "approved"),
          gt(deviceAuthorization.expires_at, now),
        ),
      )
      .returning();

    return row ?? null;
  }
}
