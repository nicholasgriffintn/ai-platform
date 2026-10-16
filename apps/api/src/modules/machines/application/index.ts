import {
  isMachineOnline,
  machineRecordSchema,
  type MachineHeartbeat,
  type MachineRecord,
} from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import type { StoredMachine } from "~/modules/machines/infrastructure/MachineRepository";
import { MachineRepository } from "~/modules/machines/infrastructure/MachineRepository";
import { publishMachineEvent } from "~/modules/sync/application/conversation-events";
import { getRequestUserSettings } from "~/modules/user/application/request-settings";

function toMachineRecord(machine: StoredMachine, now: number): MachineRecord {
  return machineRecordSchema.parse({
    machineId: machine.machineId,
    label: machine.label,
    platform: machine.platform,
    appVersion: machine.appVersion,
    runtimes: machine.runtimes,
    capabilities: machine.capabilities,
    lastSeenAt: machine.lastSeenAt,
    online: isMachineOnline(machine, now),
  });
}

async function isAdvertisingEnabled(context: ServiceContext): Promise<boolean> {
  const settings = await getRequestUserSettings(context);

  return settings?.advertise_machines !== false;
}

export async function heartbeatMachine(
  context: ServiceContext,
  heartbeat: MachineHeartbeat,
  userId?: number,
  now = Date.now(),
): Promise<MachineRecord | null> {
  const id = userId ?? context.requireUser().id;

  if (!(await isAdvertisingEnabled(context))) {
    await context.repositories.get(MachineRepository).deleteAllForUser(id);

    return null;
  }

  await context.repositories.get(MachineRepository).upsert(id, heartbeat);
  publishMachineEvent(context, id, heartbeat.machineId);

  const machine = (await context.repositories.get(MachineRepository).listForUser(id)).find(
    (candidate) => candidate.machineId === heartbeat.machineId,
  );

  if (!machine) {
    return null;
  }

  return toMachineRecord(machine, now);
}

export async function listMachines(
  context: ServiceContext,
  userId?: number,
  now = Date.now(),
): Promise<MachineRecord[]> {
  const id = userId ?? context.requireUser().id;

  if (!(await isAdvertisingEnabled(context))) {
    await context.repositories.get(MachineRepository).deleteAllForUser(id);

    return [];
  }

  const machines = await context.repositories.get(MachineRepository).listForUser(id);

  return machines.map((machine) => toMachineRecord(machine, now));
}

export async function forgetMachine(
  context: ServiceContext,
  machineId: string,
  userId?: number,
): Promise<{ forgotten: boolean }> {
  const id = userId ?? context.requireUser().id;

  await context.repositories.get(MachineRepository).deleteForUser(id, machineId);

  return { forgotten: true };
}
