import {
  DISCOVER_SIGNAL_METADATA_KEY,
  type DeviceActivitySource,
  type MachineActivity,
  type MachineActivityResponse,
} from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import {
  DEVICE_ACTIVITY_MACHINE_METADATA_KEY,
  deviceActivityDocumentTitle,
  deviceActivityProviderId,
  deviceActivitySignalId,
} from "~/modules/discover/domain/device-activity";
import { renderSignalDocument } from "~/modules/discover/domain/signal-document";

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
  const { excludedProviders } = await readDiscoverRoutine(context);
  const notebook = await ensureDiscoverNotebook(context);
  const readAt = new Date().toISOString();
  const recorded: DeviceActivitySource[] = [];
  const excluded: DeviceActivitySource[] = [];

  for (const { source, lines } of activity.sources) {
    const providerId = deviceActivityProviderId(source);

    if (excludedProviders.includes(providerId)) {
      excluded.push(source);
      continue;
    }

    const signalId = deviceActivitySignalId(machineId, source);
    const title = deviceActivityDocumentTitle(source, activity.label);

    await writeDiscoverDocument(context, notebook.id, {
      id: await discoverSignalSourceId(user.id, signalId),
      kind: "text",
      title,
      provider: providerId,
      content: renderSignalDocument({ title, readAt, lines, error: null, raw: null }),
      metadata: {
        [DISCOVER_SIGNAL_METADATA_KEY]: signalId,
        [DEVICE_ACTIVITY_MACHINE_METADATA_KEY]: machineId,
        providerId,
        readAt,
        periodStart: activity.periodStart,
        periodEnd: activity.periodEnd,
        error: null,
        lines,
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
