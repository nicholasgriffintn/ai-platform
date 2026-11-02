import {
  getNotificationInstallationId,
  getTaskNotificationSettings,
  useChatStore,
} from "@ngriffin_uk/polychat-library-client";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { registerWebPushSubscription } from "../lib/notifications/web-push-registration.js";
import { notificationPermission } from "../lib/notifications/web-push.js";

export const NOTIFICATION_SETTINGS_QUERY_KEY = ["notification-settings"] as const;

export function useNotificationSettings() {
  const isAuthenticated = useChatStore((state) => state.isAuthenticated);
  const query = useQuery({
    queryKey: NOTIFICATION_SETTINGS_QUERY_KEY,
    queryFn: getTaskNotificationSettings,
    enabled: isAuthenticated,
  });

  return { settings: query.data, isLoading: query.isLoading, refetch: query.refetch };
}

export function useWebPushRegistration() {
  const { settings, refetch } = useNotificationSettings();
  const [permission, setPermission] = useState<ReturnType<typeof notificationPermission> | null>(
    null,
  );
  const { mutateAsync, isPending, error } = useMutation({
    mutationFn: async (requestPermission: boolean) => {
      if (!settings?.webPushPublicKey) {
        throw new Error("Browser notifications are unavailable here");
      }

      await registerWebPushSubscription(settings.webPushPublicKey, requestPermission);
      await refetch();
      setPermission(notificationPermission());
    },
  });

  useEffect(() => {
    const update = () => {
      setPermission(notificationPermission());
      if (notificationPermission() === "granted" && settings?.webPushPublicKey) {
        void mutateAsync(false).catch(() => undefined);
      }
    };

    update();
    document.addEventListener("visibilitychange", update);

    return () => document.removeEventListener("visibilitychange", update);
  }, [settings?.webPushPublicKey, mutateAsync]);

  const registered =
    permission === "granted" &&
    settings?.registrations.some(
      (registration) =>
        registration.installationId === getNotificationInstallationId() &&
        registration.state === "registered",
    );

  return {
    registered: Boolean(registered),
    permission,
    available: Boolean(settings?.webPushPublicKey),
    register: () => mutateAsync(true),
    isRegistering: isPending,
    error,
  };
}
