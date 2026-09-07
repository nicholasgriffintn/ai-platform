import { getNotificationInstallationId } from "@ngriffin_uk/polychat-library-client";
import { useTaskNotifications } from "@ngriffin_uk/polychat-library-react";
import { useState } from "react";

import type { TaskNotificationChannel } from "./task-notification-channel.js";

export function useWebPushTaskNotificationChannel(): TaskNotificationChannel {
  const { settings, permission, registrationError, isUpdating, enable, disable } =
    useTaskNotifications();
  const [installationId] = useState(getNotificationInstallationId);

  const registration = settings?.registrations.find(
    (candidate) => candidate.platform === "web" && candidate.installationId === installationId,
  );
  const isRegistered = registration?.state === "registered";

  const status = (() => {
    if (permission === null) {
      return "Checking browser notification permission…";
    }

    if (permission === "unsupported") {
      return "This browser does not support push notifications.";
    }

    if (permission === "denied") {
      return "Browser permission is blocked. Allow notifications in browser settings, then retry.";
    }

    if (registrationError) {
      return registrationError;
    }

    if (permission === "granted" && registration?.state === "failed") {
      return "Browser permission is allowed, but server registration failed. Retry to replace it.";
    }

    if (permission === "granted" && isRegistered) {
      return "Browser permission and server registration are active.";
    }

    return "Allow browser notifications to hear about task changes when Polychat is closed.";
  })();

  return {
    status,
    isDeliverable: Boolean(settings?.preferences.enabled) && isRegistered,
    isUnavailable: permission === "unsupported",
    error: registrationError,
    isBusy: isUpdating,
    enable,
    disable,
    retry: registrationError && permission !== "unsupported" ? enable : null,
  };
}
