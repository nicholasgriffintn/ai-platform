import { apiService } from "@ngriffin_uk/polychat-library-client";
import {
  DEVICE_ACTIVITY_CHANGED_EVENT,
  deviceActivityBrowserSchema,
  deviceActivityCollectionSchema,
  deviceActivityPermissionsSchema,
  deviceActivitySentSchema,
  deviceActivitySettingsSchema,
  deviceActivityStatusSchema,
  machineActivitySchema,
  type DeviceActivityCollection,
  type DeviceActivityNeverShareKey,
  type DeviceActivityPauseChoice,
  type DeviceActivitySettings,
  type MachineActivity,
} from "@ngriffin_uk/polychat-schemas";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

import { tauriDesktopBackend } from "./desktop-backend";

export const DEVICE_ACTIVITY_INTERVAL_MS = 60 * 60_000;

export const deviceActivityBackend = {
  readSettings: async () =>
    deviceActivitySettingsSchema.parse(await invoke("read_activity_settings")),
  saveSettings: (settings: DeviceActivitySettings) =>
    invoke<void>("save_activity_settings", { settings }),
  readStatus: async () => deviceActivityStatusSchema.parse(await invoke("read_activity_status")),
  pause: (choice: DeviceActivityPauseChoice) => invoke<void>("pause_activity", { choice }),
  resume: () => invoke<void>("resume_activity"),
  detectBrowsers: async () =>
    deviceActivityBrowserSchema.array().parse(await invoke("detect_activity_browsers")),
  collect: async () =>
    deviceActivityCollectionSchema.nullable().parse(await invoke("collect_activity")),
  recordSent: (collection: DeviceActivityCollection) =>
    invoke<void>("record_activity_sent", { collection }),
  listSent: async () => deviceActivitySentSchema.array().parse(await invoke("list_activity_sent")),
  forgetSent: () => invoke<void>("forget_activity_sent"),
  neverShare: (key: DeviceActivityNeverShareKey) => invoke<void>("never_share_activity", { key }),
  readPermissions: async () =>
    deviceActivityPermissionsSchema.parse(await invoke("read_activity_permissions")),
  openPrivacyPane: (pane: "accessibility" | "automation") =>
    invoke<void>("open_activity_privacy_pane", { pane }),
};

export function toMachineActivity(collection: DeviceActivityCollection): MachineActivity {
  return machineActivitySchema.parse({
    label: collection.label,
    periodStart: collection.periodStart,
    periodEnd: collection.periodEnd,
    sources: collection.sources.map(({ source, items, entries }) => ({
      source,
      lines: items.map((item) => item.line),
      items: entries.map((entry) => ({
        title: entry.title,
        url: entry.url,
        detail: entry.detail,
      })),
    })),
  });
}

export async function shareDeviceActivity(): Promise<void> {
  const collection = await deviceActivityBackend.collect();

  if (!collection) {
    return;
  }

  await apiService.shareMachineActivity(collection.machineId, toMachineActivity(collection));
  await deviceActivityBackend.recordSent(collection);
}

export async function forgetSharedDeviceActivity(): Promise<void> {
  const { machineId } = await tauriDesktopBackend.collectDiagnostics();

  await apiService.forgetMachineActivity(machineId);
  await deviceActivityBackend.forgetSent();
}

export function onDeviceActivityChanged(changed: () => void): () => void {
  let stopped = false;
  let stop: (() => void) | undefined;

  const subscribe = async () => {
    const unlisten = await listen(DEVICE_ACTIVITY_CHANGED_EVENT, () => {
      if (!stopped) {
        changed();
      }
    });

    stop = unlisten;

    if (stopped) {
      unlisten();
    }
  };

  subscribe().catch(() => undefined);

  return () => {
    stopped = true;
    stop?.();
  };
}
