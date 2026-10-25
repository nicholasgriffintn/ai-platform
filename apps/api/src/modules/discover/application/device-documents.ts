import { parseJsonRecord } from "@ngriffin_uk/polychat-utility-server/json";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { DEVICE_ACTIVITY_MACHINE_METADATA_KEY } from "~/modules/discover/domain/device-activity";
import { deleteSource } from "~/modules/sources/application/sources";
import {
  SourceRepository,
  type SourceRecord,
} from "~/modules/sources/infrastructure/SourceRepository";

import { findDiscoverNotebook } from "./notebook";

export async function listDeviceDocuments(
  context: ServiceContext,
  notebookId: string,
  matches: (source: SourceRecord, machineId: string) => boolean,
): Promise<SourceRecord[]> {
  const sources = await context.repositories
    .get(SourceRepository)
    .listCollectionSources(notebookId);

  return sources.filter((source) => {
    const machineId = parseJsonRecord(source.metadata)[DEVICE_ACTIVITY_MACHINE_METADATA_KEY];

    return typeof machineId === "string" && matches(source, machineId);
  });
}

export async function deleteDeviceDocuments(
  context: ServiceContext,
  documents: readonly SourceRecord[],
): Promise<void> {
  const userId = context.requireUser().id;

  for (const document of documents) {
    await deleteSource(context, userId, document.id);
  }
}

export async function forgetDeviceActivity(
  context: ServiceContext,
  filter: { machineId: string } | { providerId: string },
): Promise<void> {
  const notebook = await findDiscoverNotebook(context, context.requireUser().id);

  if (!notebook) {
    return;
  }

  await deleteDeviceDocuments(
    context,
    await listDeviceDocuments(context, notebook.id, (source, machineId) =>
      "machineId" in filter
        ? machineId === filter.machineId
        : source.provider === filter.providerId,
    ),
  );
}
