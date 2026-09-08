import { authService, useChatStore } from "@ngriffin_uk/polychat-library-client";
import type { LastModelSelection } from "@ngriffin_uk/polychat-schemas";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { toast } from "sonner";

import { AUTH_QUERY_KEYS } from "../hooks/useAuth.js";
import { getPickerInstallationId } from "../lib/model-picker.js";

export function useLastModelSelection() {
  const [installationId] = useState(getPickerInstallationId);
  const userId = useChatStore((state) => state.user?.id);
  const saved = useChatStore((state) => state.userSettings?.last_model_selection);
  const [local, setLocal] = useState<{ userId?: number; selection: LastModelSelection }>();
  const queryClient = useQueryClient();
  const mutation = useMutation({
    scope: { id: `last-model-selection:${userId ?? "anonymous"}` },
    mutationFn: async (selection: LastModelSelection) => {
      if (useChatStore.getState().user?.id !== userId) {
        return;
      }

      if (!(await authService.updateUserSettings({ last_model_selection: selection }))) {
        throw new Error("Last used could not sync. Your model is still selected.");
      }
    },
    onSuccess: (_, selection) => {
      if (useChatStore.getState().user?.id !== userId) {
        return;
      }

      useChatStore.getState().setUserSettings(authService.getUserSettings());
      setLocal((current) => (current?.selection === selection ? undefined : current));
      void queryClient.invalidateQueries({ queryKey: AUTH_QUERY_KEYS.authStatus });
    },
    onError: (error) => toast.error(error.message),
  });
  const { mutate } = mutation;
  const remember = useCallback(
    (selection: LastModelSelection) => {
      const locatedSelection =
        selection.computeSite === "device"
          ? { ...selection, originInstallationId: installationId }
          : selection;

      setLocal({ userId, selection: locatedSelection });
      if (userId) {
        mutate(locatedSelection);
      }
    },
    [mutate, userId, installationId],
  );

  return {
    installationId,
    selection: local?.userId === userId ? (local?.selection ?? saved) : saved,
    remember,
    syncError: mutation.error?.message,
  };
}
