import type {
  TaskNotificationCategory,
  UpdateTaskNotificationPreferences,
} from "@ngriffin_uk/polychat-schemas";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import {
  getTaskNotificationSettings,
  registerTaskNotifications,
  removeTaskNotificationRegistration,
  updateTaskNotificationSettings,
} from "~/lib/api/task-notifications";
import { getNotificationInstallationId } from "~/lib/notifications/installation";
import { decodeWebPushPublicKey, notificationPermission } from "~/lib/notifications/web-push";
import { useChatStore } from "~/state/stores/chatStore";

export const TASK_NOTIFICATION_SETTINGS_QUERY_KEY = ["task-notification-settings"] as const;

async function currentPushSubscription() {
  if (!("serviceWorker" in navigator)) {
    return null;
  }

  const registration = await navigator.serviceWorker.ready;

  return registration.pushManager.getSubscription();
}

async function registerSubscription(publicKey: string, requestPermission: boolean) {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    throw new Error("Push notifications are not supported in this browser");
  }

  let permission = notificationPermission();

  if (requestPermission && permission === "default") {
    permission = await Notification.requestPermission();
  }

  if (permission !== "granted") {
    throw new Error(
      permission === "denied"
        ? "Notifications are blocked in browser settings"
        : "Notification permission was not granted",
    );
  }

  const serviceWorker = await navigator.serviceWorker.ready;
  const subscription =
    (await serviceWorker.pushManager.getSubscription()) ??
    (await serviceWorker.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: decodeWebPushPublicKey(publicKey),
    }));
  const json = subscription.toJSON();

  if (!json.endpoint || !json.keys?.p256dh || !json.keys.auth) {
    throw new Error("The browser returned an incomplete push subscription");
  }

  return registerTaskNotifications({
    platform: "web",
    installationId: getNotificationInstallationId(),
    subscription: {
      endpoint: json.endpoint,
      expirationTime: subscription.expirationTime,
      keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
    },
  });
}

export function useTaskNotifications() {
  const isAuthenticated = useChatStore((state) => state.isAuthenticated);
  const isPro = useChatStore((state) => state.isPro);
  const queryClient = useQueryClient();
  const [permission, setPermission] = useState<ReturnType<typeof notificationPermission> | null>(
    null,
  );
  const [registrationError, setRegistrationError] = useState<string | null>(null);

  const settings = useQuery({
    queryKey: TASK_NOTIFICATION_SETTINGS_QUERY_KEY,
    queryFn: getTaskNotificationSettings,
    enabled: isAuthenticated && isPro,
  });
  const notificationSettings = settings.data;
  const refetchSettings = settings.refetch;

  const enable = useMutation({
    mutationFn: async () => {
      const publicKey = notificationSettings?.webPushPublicKey;

      if (!publicKey) {
        throw new Error("Web push is not configured on this Polychat server");
      }

      await registerSubscription(publicKey, true);

      return updateTaskNotificationSettings({ enabled: true });
    },
    onSuccess: (next) => {
      setPermission(notificationPermission());
      setRegistrationError(null);
      queryClient.setQueryData(TASK_NOTIFICATION_SETTINGS_QUERY_KEY, next);
    },
    onError: (error) => {
      setPermission(notificationPermission());
      setRegistrationError(error instanceof Error ? error.message : "Registration failed");
    },
  });

  const disable = useMutation({
    mutationFn: async () => {
      const installationId = getNotificationInstallationId();
      const next = await updateTaskNotificationSettings({ enabled: false });
      const subscription = await currentPushSubscription();

      await Promise.allSettled([
        removeTaskNotificationRegistration(installationId),
        subscription?.unsubscribe(),
      ]);

      return next;
    },
    onSuccess: (next) => {
      setRegistrationError(null);
      queryClient.setQueryData(TASK_NOTIFICATION_SETTINGS_QUERY_KEY, {
        ...next,
        registrations: next.registrations.filter(
          (registration) => registration.installationId !== getNotificationInstallationId(),
        ),
      });
    },
  });

  const updatePreferences = useMutation({
    mutationFn: (updates: UpdateTaskNotificationPreferences) =>
      updateTaskNotificationSettings(updates),
    onSuccess: (next) => queryClient.setQueryData(TASK_NOTIFICATION_SETTINGS_QUERY_KEY, next),
  });

  useEffect(() => {
    const reconcile = async () => {
      const currentPermission = notificationPermission();

      setPermission(currentPermission);

      if (
        currentPermission !== "granted" ||
        !notificationSettings?.preferences.enabled ||
        !notificationSettings.webPushPublicKey
      ) {
        return;
      }

      try {
        const subscription = await currentPushSubscription();

        if (subscription) {
          await registerSubscription(notificationSettings.webPushPublicKey, false);
          await refetchSettings();
          setRegistrationError(null);
        }
      } catch (error) {
        setRegistrationError(error instanceof Error ? error.message : "Registration failed");
      }
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void reconcile();
      }
    };

    void reconcile();
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [
    notificationSettings?.preferences.enabled,
    notificationSettings?.webPushPublicKey,
    refetchSettings,
  ]);

  const setCategory = (category: TaskNotificationCategory, enabled: boolean) =>
    updatePreferences.mutateAsync({ [category]: enabled });

  return {
    settings: notificationSettings,
    permission,
    registrationError,
    isLoading: settings.isLoading,
    isUpdating: enable.isPending || disable.isPending || updatePreferences.isPending,
    enable: enable.mutateAsync,
    disable: disable.mutateAsync,
    setCategory,
  };
}
