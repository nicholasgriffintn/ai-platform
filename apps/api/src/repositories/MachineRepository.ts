import {
  machineHeartbeatSchema,
  type MachineCapability,
  type MachineHeartbeat,
  type MachineRuntime,
} from "@ngriffin_uk/polychat-schemas";

import { safeParseJson } from "~/utils/json";

import { BaseRepository } from "./BaseRepository";

interface MachineRow {
  user_id: number;
  machine_id: string;
  label: string;
  platform: MachineHeartbeat["platform"];
  app_version: string;
  runtimes: string;
  capabilities: string;
  last_seen_at: string;
  created_at: string;
  updated_at: string;
}

export interface StoredMachine {
  userId: number;
  machineId: string;
  label: string;
  platform: MachineHeartbeat["platform"];
  appVersion: string;
  runtimes: MachineRuntime[];
  capabilities: MachineCapability[];
  lastSeenAt: string;
}

function toStoredMachine(row: MachineRow): StoredMachine {
  const heartbeat = machineHeartbeatSchema.parse({
    machineId: row.machine_id,
    label: row.label,
    platform: row.platform,
    appVersion: row.app_version,
    runtimes: safeParseJson<unknown>(row.runtimes) ?? [],
    capabilities: safeParseJson<unknown>(row.capabilities) ?? [],
  });

  return {
    userId: row.user_id,
    ...heartbeat,
    lastSeenAt: row.last_seen_at,
  };
}

export class MachineRepository extends BaseRepository {
  async upsert(userId: number, heartbeat: MachineHeartbeat): Promise<void> {
    await this.executeRun(
      `INSERT INTO machine (
         user_id, machine_id, label, platform, app_version, runtimes, capabilities, last_seen_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(user_id, machine_id) DO UPDATE SET
         label = excluded.label,
         platform = excluded.platform,
         app_version = excluded.app_version,
         runtimes = excluded.runtimes,
         capabilities = excluded.capabilities,
         last_seen_at = CURRENT_TIMESTAMP,
         updated_at = CURRENT_TIMESTAMP`,
      [
        userId,
        heartbeat.machineId,
        heartbeat.label,
        heartbeat.platform,
        heartbeat.appVersion,
        JSON.stringify(heartbeat.runtimes),
        JSON.stringify(heartbeat.capabilities),
      ],
    );
  }

  async listForUser(userId: number): Promise<StoredMachine[]> {
    const rows = await this.runQuery<MachineRow>(
      `SELECT user_id, machine_id, label, platform, app_version, runtimes, capabilities,
              last_seen_at, created_at, updated_at
       FROM machine
       WHERE user_id = ?
       ORDER BY last_seen_at DESC, machine_id`,
      [userId],
    );

    return rows.map(toStoredMachine);
  }

  async deleteForUser(userId: number, machineId: string): Promise<void> {
    await this.executeRun("DELETE FROM machine WHERE user_id = ? AND machine_id = ?", [
      userId,
      machineId,
    ]);
  }

  async deleteAllForUser(userId: number): Promise<void> {
    await this.executeRun("DELETE FROM machine WHERE user_id = ?", [userId]);
  }
}
