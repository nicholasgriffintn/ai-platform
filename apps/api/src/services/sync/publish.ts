import {
  buildDeviceSyncTopic,
  type DeviceSyncEventType,
  type DeviceSyncPresenceEntry,
  type DeviceSyncTopicKind,
} from "@ngriffin_uk/polychat-schemas";

import { getDurableObjectStub, postDurableObjectJson } from "~/lib/durable-objects/client";
import { addInfraUsage } from "~/lib/usage/requestMeter";
import type { IEnv } from "~/types";
import { getLogger } from "~/utils/logger";

const logger = getLogger({ prefix: "services/sync/publish" });
const COORDINATOR_ORIGIN = "https://user-sync-coordinator";

export interface SyncPublication {
  audience: number[];
  topic: string;
  type: DeviceSyncEventType;
  data?: Record<string, unknown>;
  originDeviceId?: string | null;
}

export function syncTopic(kind: DeviceSyncTopicKind, id: string | number): string {
  return buildDeviceSyncTopic(kind, id);
}

export async function publishSyncEvent(
  env: IEnv | undefined,
  publication: SyncPublication,
): Promise<void> {
  const namespace = env?.USER_SYNC_COORDINATOR;

  if (!namespace || publication.audience.length === 0) {
    return;
  }

  const body = {
    topic: publication.topic,
    type: publication.type,
    data: publication.data ?? {},
    originDeviceId: publication.originDeviceId ?? null,
  };

  await Promise.all(
    [...new Set(publication.audience)].map(async (userId) => {
      const stub = getDurableObjectStub(namespace, String(userId));

      if (!stub) {
        return;
      }

      try {
        const response = await postDurableObjectJson(stub, `${COORDINATOR_ORIGIN}/publish`, body);

        if (!response.ok) {
          logger.error("Sync coordinator refused an event", {
            status: response.status,
            topic: publication.topic,
            userId,
          });
        }
      } catch (error) {
        logger.error("Sync publish failed", { error, topic: publication.topic, userId });
      }
    }),
  );
}

export async function readSyncPresence(
  env: IEnv | undefined,
  userId: number,
  topic: string,
): Promise<DeviceSyncPresenceEntry[]> {
  const stub = getDurableObjectStub(env?.USER_SYNC_COORDINATOR, String(userId));

  if (!stub) {
    return [];
  }

  try {
    addInfraUsage("do_requests", 1);

    const response = await stub.fetch(
      `${COORDINATOR_ORIGIN}/presence?topic=${encodeURIComponent(topic)}`,
      { method: "GET", headers: { Accept: "application/json" } },
    );

    if (!response.ok) {
      return [];
    }

    const payload = (await response.json()) as { devices?: DeviceSyncPresenceEntry[] };

    return Array.isArray(payload.devices) ? payload.devices : [];
  } catch (error) {
    logger.error("Sync presence read failed", { error, topic, userId });

    return [];
  }
}

export async function hasLiveSyncDevice(
  env: IEnv | undefined,
  userId: number,
  topic: string,
): Promise<boolean> {
  return (await readSyncPresence(env, userId, topic)).length > 0;
}
