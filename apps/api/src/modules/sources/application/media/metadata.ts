import {
  readSourceGeneration,
  readSourceMedia,
  type SourceGeneration,
  type SourceMediaMetadata,
  type SourceStatus,
} from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import { parseJsonRecord } from "@ngriffin_uk/polychat-utility-server/json";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import {
  SourceRepository,
  type SourceRecord,
} from "~/modules/sources/infrastructure/SourceRepository";
import { publishResourceEvent } from "~/modules/sync/application/resource-events";

export interface SourcePendingInvocation {
  asyncInvocation: Record<string, unknown>;
}

export function readSourceRecordMedia(source: SourceRecord): SourceMediaMetadata {
  return readSourceMedia(parseJsonRecord(source.metadata));
}

export function readSourceRecordGeneration(source: SourceRecord): SourceGeneration | null {
  return readSourceGeneration(parseJsonRecord(source.metadata));
}

export function readSourcePending(source: SourceRecord): SourcePendingInvocation | null {
  const pending = parseJsonRecord(source.metadata).pending;

  return pending && typeof pending === "object" && "asyncInvocation" in pending
    ? (pending as SourcePendingInvocation)
    : null;
}

export interface SourceMetadataPatch {
  media?: Partial<SourceMediaMetadata>;
  generation?: Partial<SourceGeneration>;
  pending?: SourcePendingInvocation | null;
}

export function mergeSourceMetadata(
  metadata: Record<string, unknown>,
  patch: SourceMetadataPatch,
): Record<string, unknown> {
  const next: Record<string, unknown> = { ...metadata };

  if (patch.media) {
    next.media = { ...readSourceMedia(metadata), ...patch.media };
  }

  if (patch.generation) {
    next.generation = { ...readSourceGeneration(metadata), ...patch.generation };
  }

  if (patch.pending === null) {
    delete next.pending;
  } else if (patch.pending) {
    next.pending = patch.pending;
  }

  return next;
}

export async function publishSourceChanged(
  context: ServiceContext,
  source: SourceRecord,
): Promise<void> {
  await publishResourceEvent(
    context,
    source.project_id
      ? { kind: "project", projectId: source.project_id }
      : { kind: "personal", userId: source.created_by_user_id },
    "source.changed",
    { sourceId: source.id },
  );
}

export async function updateSourceRecord(
  context: ServiceContext,
  source: SourceRecord,
  patch: SourceMetadataPatch & {
    title?: string;
    status?: SourceStatus;
    content?: string | null;
  },
): Promise<SourceRecord> {
  const { media, generation, pending, ...fields } = patch;
  const repository = context.repositories.get(SourceRepository);

  await repository.updateSource(source.id, {
    ...fields,
    metadata: mergeSourceMetadata(parseJsonRecord(source.metadata), {
      media,
      generation,
      pending,
    }),
  });

  const updated = await repository.getSource(source.id);

  if (!updated) {
    throw new AssistantError("Source not found", ErrorType.NOT_FOUND, 404);
  }

  await publishSourceChanged(context, updated);

  return updated;
}
