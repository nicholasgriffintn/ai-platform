import { useTaskNotificationPreferences } from "@ngriffin_uk/polychat-library-react";

import type { TaskNotificationChannel } from "./task-notification-channel";

export function useDeviceTaskNotificationChannel(): TaskNotificationChannel {
  const { settings, isUpdating, setEnabled } = useTaskNotificationPreferences();
  const isEnabled = Boolean(settings?.preferences.enabled);

  return {
    status: isEnabled
      ? "This device raises task notifications and badges the icon while Polychat is running. If none arrive, allow notifications for Polychat in your system settings."
      : "Turn on to have this device raise task notifications and badge the icon while Polychat is running.",
    isDeliverable: isEnabled,
    isUnavailable: false,
    error: null,
    isBusy: isUpdating,
    enable: () => setEnabled(true),
    disable: () => setEnabled(false),
    retry: null,
  };
}
