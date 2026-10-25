import type {
  DeviceActivityNeverShareKey,
  DeviceActivityPauseChoice,
  DeviceActivitySettings,
} from "@ngriffin_uk/polychat-schemas";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import {
  deviceActivityBackend,
  forgetSharedDeviceActivity,
  onDeviceActivityChanged,
  shareDeviceActivity,
} from "../infrastructure/device-activity";

const DEVICE_ACTIVITY_KEY = ["device-activity"] as const;

export function useDeviceActivitySettings() {
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: DEVICE_ACTIVITY_KEY });
  const settings = useQuery({
    queryKey: [...DEVICE_ACTIVITY_KEY, "settings"],
    queryFn: deviceActivityBackend.readSettings,
  });
  const status = useQuery({
    queryKey: [...DEVICE_ACTIVITY_KEY, "status"],
    queryFn: deviceActivityBackend.readStatus,
  });
  const browsers = useQuery({
    queryKey: [...DEVICE_ACTIVITY_KEY, "browsers"],
    queryFn: deviceActivityBackend.detectBrowsers,
  });
  const sent = useQuery({
    queryKey: [...DEVICE_ACTIVITY_KEY, "sent"],
    queryFn: deviceActivityBackend.listSent,
  });
  const permissions = useQuery({
    queryKey: [...DEVICE_ACTIVITY_KEY, "permissions"],
    queryFn: deviceActivityBackend.readPermissions,
  });

  useEffect(
    () =>
      onDeviceActivityChanged(
        () => void queryClient.invalidateQueries({ queryKey: DEVICE_ACTIVITY_KEY }),
      ),
    [queryClient],
  );

  const save = useMutation({
    mutationFn: async (next: DeviceActivitySettings) => {
      await deviceActivityBackend.saveSettings(next);

      if (!next.enabled && settings.data?.enabled) {
        await forgetSharedDeviceActivity();
      }
    },
    onSettled: refresh,
  });
  const pause = useMutation({
    mutationFn: (choice: DeviceActivityPauseChoice) => deviceActivityBackend.pause(choice),
    onSettled: refresh,
  });
  const resume = useMutation({
    mutationFn: deviceActivityBackend.resume,
    onSettled: refresh,
  });
  const neverShare = useMutation({
    mutationFn: (key: DeviceActivityNeverShareKey) => deviceActivityBackend.neverShare(key),
    onSettled: refresh,
  });
  const sendNow = useMutation({ mutationFn: shareDeviceActivity, onSettled: refresh });
  const forget = useMutation({ mutationFn: forgetSharedDeviceActivity, onSettled: refresh });

  return {
    settings: settings.data,
    status: status.data,
    browsers: browsers.data ?? [],
    sent: sent.data ?? [],
    permissions: permissions.data,
    isLoading: settings.isLoading,
    loadError: settings.error?.message,
    save,
    pause,
    resume,
    neverShare,
    sendNow,
    forget,
    openPrivacyPane: deviceActivityBackend.openPrivacyPane,
  };
}

export type DeviceActivityController = ReturnType<typeof useDeviceActivitySettings>;
