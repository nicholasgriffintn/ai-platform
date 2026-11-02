import { updateTaskNotificationSettings } from "@ngriffin_uk/polychat-library-client";
import type {
  TaskNotificationCategory,
  UpdateTaskNotificationPreferences,
} from "@ngriffin_uk/polychat-schemas";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import {
  NOTIFICATION_SETTINGS_QUERY_KEY,
  useNotificationSettings,
  useWebPushRegistration,
} from "./useWebPushRegistration.js";

export function useTaskNotificationPreferences() {
  const queryClient = useQueryClient();
  const { settings, isLoading, refetch } = useNotificationSettings();

  const updatePreferences = useMutation({
    mutationFn: (updates: UpdateTaskNotificationPreferences) =>
      updateTaskNotificationSettings(updates),
    onSuccess: (next) => queryClient.setQueryData(NOTIFICATION_SETTINGS_QUERY_KEY, next),
  });

  return {
    settings,
    isLoading,
    refetch,
    isUpdating: updatePreferences.isPending,
    setEnabled: (enabled: boolean) => updatePreferences.mutateAsync({ enabled }),
    setCategory: (category: TaskNotificationCategory, enabled: boolean) =>
      updatePreferences.mutateAsync({ [category]: enabled }),
  };
}

export function useTaskNotifications() {
  const preferences = useTaskNotificationPreferences();
  const registration = useWebPushRegistration();
  const enable = async () => {
    await registration.register();

    return preferences.setEnabled(true);
  };

  return {
    settings: preferences.settings,
    permission: registration.permission,
    registrationError: registration.error instanceof Error ? registration.error.message : null,
    isLoading: preferences.isLoading,
    isUpdating: preferences.isUpdating || registration.isRegistering,
    enable,
    disable: () => preferences.setEnabled(false),
    setCategory: preferences.setCategory,
  };
}
