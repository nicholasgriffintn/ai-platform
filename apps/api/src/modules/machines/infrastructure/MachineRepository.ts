import {
  machineHeartbeatSchema,
  type MachineCapability,
  type MachineHeartbeat,
  type MachineRuntime,
} from "@ngriffin_uk/polychat-schemas";
import { safeParseJson } from "@ngriffin_uk/polychat-utility-server/json";

import { BaseRepository } from "~/infrastructure/database/BaseRepository";

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

const MACHINE_COLUMNS = `m.user_id, m.machine_id, m.label, m.platform, m.app_version, m.runtimes,
  m.capabilities, m.last_seen_at, m.created_at, m.updated_at`;

const SHARING_JOIN = `JOIN scoped_configuration prefs
    ON prefs.kind = 'preferences' AND prefs.user_id = m.user_id
   AND json_extract(prefs.payload, '$.share_machines_with_work') = 1
   AND COALESCE(json_extract(prefs.payload, '$.advertise_machines'), 1) != 0`;

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

  async listSharedInWorkspace(workspaceId: string): Promise<StoredMachine[]> {
    const rows = await this.runQuery<MachineRow>(
      `SELECT ${MACHINE_COLUMNS}
       FROM machine m
       JOIN resource_grant member
         ON member.kind = 'membership' AND member.workspace_id = ? AND member.user_id = m.user_id
       ${SHARING_JOIN}
       ORDER BY m.last_seen_at DESC, m.machine_id`,
      [workspaceId],
    );

    return rows.map(toStoredMachine);
  }

  async findAccessible(requesterId: number, machineId: string): Promise<StoredMachine | null> {
    const rows = await this.runQuery<MachineRow>(
      `SELECT ${MACHINE_COLUMNS}
       FROM machine m
       WHERE m.machine_id = ? AND m.user_id = ?
       UNION ALL
       SELECT ${MACHINE_COLUMNS}
       FROM machine m
       ${SHARING_JOIN}
       WHERE m.machine_id = ? AND m.user_id != ?
         AND EXISTS (
           SELECT 1 FROM resource_grant mine
           JOIN resource_grant theirs
             ON theirs.kind = 'membership'
            AND theirs.workspace_id = mine.workspace_id
            AND theirs.user_id = m.user_id
           WHERE mine.kind = 'membership' AND mine.user_id = ?
         )
       LIMIT 1`,
      [machineId, requesterId, machineId, requesterId, requesterId],
    );

    return rows[0] ? toStoredMachine(rows[0]) : null;
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
