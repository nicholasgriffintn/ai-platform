import {
  buildDeviceSyncTopic,
  type DeviceSyncEventType,
  type DeviceSyncTopicKind,
} from "@ngriffin_uk/polychat-schemas";

import { getDurableObjectStub, postDurableObjectJson } from "~/lib/durable-objects/client";
import type { IEnv } from "~/types";
import { getLogger } from "~/utils/logger";

const logger = getLogger({ prefix: "services/sync/publish" });
const COORDINATOR_ORIGIN = "https://user-sync-coordinator";

export type SyncEnv = Pick<IEnv, "DB" | "USER_SYNC_COORDINATOR">;

export interface SyncPublisher {
  env: SyncEnv | undefined;
  originDeviceId?: string | null;
  waitUntil?: (work: Promise<unknown>) => void;
}

export function withoutOrigin(publisher: SyncPublisher): SyncPublisher {
  return { env: publisher.env, waitUntil: publisher.waitUntil };
}

export interface SyncPublication {
  audience: number[];
  topic: string;
  type: DeviceSyncEventType;
  data?: Record<string, unknown>;
  originDeviceId?: string | null;
}

interface SyncEnvelope {
  topic: string;
  type: DeviceSyncEventType;
  data: Record<string, unknown>;
  originDeviceId: string | null;
}

export function syncTopic(kind: DeviceSyncTopicKind, id: string | number): string {
  return buildDeviceSyncTopic(kind, id);
}

function groupByRecipient(
  publications: SyncPublication[],
  originDeviceId: string | null,
): Map<number, SyncEnvelope[]> {
  const byRecipient = new Map<number, SyncEnvelope[]>();

  for (const publication of publications) {
    const envelope: SyncEnvelope = {
      topic: publication.topic,
      type: publication.type,
      data: publication.data ?? {},
      originDeviceId: publication.originDeviceId ?? originDeviceId,
    };

    for (const userId of new Set(publication.audience)) {
      const existing = byRecipient.get(userId);

      if (existing) {
        existing.push(envelope);
      } else {
        byRecipient.set(userId, [envelope]);
      }
    }
  }

  return byRecipient;
}

export async function publishSyncEvents(
  env: SyncEnv | undefined,
  publications: SyncPublication[],
  originDeviceId: string | null = null,
): Promise<void> {
  const namespace = env?.USER_SYNC_COORDINATOR;

  if (!namespace || publications.length === 0) {
    return;
  }

  await Promise.all(
    [...groupByRecipient(publications, originDeviceId)].map(async ([userId, events]) => {
      const stub = getDurableObjectStub(namespace, String(userId));

      if (!stub) {
        return;
      }

      try {
        const response = await postDurableObjectJson(stub, `${COORDINATOR_ORIGIN}/publish`, {
          events,
        });

        if (!response.ok) {
          logger.error("Sync coordinator refused a batch", { status: response.status, userId });
        }
      } catch (error) {
        logger.error("Sync publish failed", { error, userId });
      }
    }),
  );
}

export function publishSync(publisher: SyncPublisher, publications: SyncPublication[]): void {
  const work = publishSyncEvents(publisher.env, publications, publisher.originDeviceId ?? null);

  if (publisher.waitUntil) {
    publisher.waitUntil(work);

    return;
  }

  void work.catch(() => undefined);
}
