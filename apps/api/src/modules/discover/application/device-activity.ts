import {
  DISCOVER_SIGNAL_METADATA_KEY,
  type DeviceActivitySource,
  type MachineActivity,
  type MachineActivityResponse,
} from "@ngriffin_uk/polychat-schemas";
import { describeZonedInstant } from "@ngriffin_uk/polychat-utility-core";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import {
  DEVICE_ACTIVITY_MACHINE_METADATA_KEY,
  deviceActivityDocumentTitle,
  deviceActivityProviderId,
  deviceActivitySignalId,
  describeDeviceActivityItems,
  readDeviceActivityPages,
  renderDeviceActivityHistory,
} from "~/modules/discover/domain/device-activity";
import { readKnowledgeText } from "~/modules/knowledge/application/intake/body";
import { SourceRepository } from "~/modules/sources/infrastructure/SourceRepository";

import { deleteDeviceDocuments, listDeviceDocuments } from "./device-documents";
import { ensureDiscoverNotebook } from "./notebook";
import { readDiscoverRoutine } from "./settings";
import { discoverSignalSourceId, writeDiscoverDocument } from "./signal-documents";

export async function recordDeviceActivity(
  context: ServiceContext,
  machineId: string,
  activity: MachineActivity,
): Promise<MachineActivityResponse> {
  const user = context.requireUser();
  const { excludedProviders, timezone } = await readDiscoverRoutine(context);
  const notebook = await ensureDiscoverNotebook(context);
  const sources = context.repositories.get(SourceRepository);
  const readAt = new Date().toISOString();
  const date = describeZonedInstant(new Date(activity.periodEnd), timezone ?? "UTC").date;
  const recorded: DeviceActivitySource[] = [];
  const excluded: DeviceActivitySource[] = [];

  for (const { source, lines, items = [] } of activity.sources) {
    const providerId = deviceActivityProviderId(source);

    if (excludedProviders.includes(providerId)) {
      excluded.push(source);
      continue;
    }

    const signalId = deviceActivitySignalId(machineId, source);
    const title = deviceActivityDocumentTitle(source, activity.label);
    const id = await discoverSignalSourceId(user.id, signalId);
    const existing = await sources.getSource(id);
    const owned = existing?.created_by_user_id === user.id ? existing : null;
    const shared = [...describeDeviceActivityItems(items), ...lines];
    const content = renderDeviceActivityHistory(
      title,
      owned ? await readKnowledgeText(context, owned) : "",
      {
        date,
        lines: shared,
      },
    );

    await writeDiscoverDocument(context, notebook.id, {
      id,
      origin: "device",
      kind: "text",
      title,
      provider: providerId,
      content,
      metadata: {
        [DISCOVER_SIGNAL_METADATA_KEY]: signalId,
        [DEVICE_ACTIVITY_MACHINE_METADATA_KEY]: machineId,
        providerId,
        readAt,
        periodStart: activity.periodStart,
        periodEnd: activity.periodEnd,
        error: null,
        lines: shared,
        items: readDeviceActivityPages(items, date),
      },
    });

    recorded.push(source);
  }

  const kept = new Set(recorded.map(deviceActivityProviderId));

  await deleteDeviceDocuments(
    context,
    await listDeviceDocuments(
      context,
      notebook.id,
      (source, owner) => owner === machineId && !kept.has(source.provider ?? ""),
    ),
  );

  return { recorded, excluded };
}
