import {
  authService,
  speechVoicesService,
  useChatStore,
} from "@ngriffin_uk/polychat-library-client";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { AUTH_QUERY_KEYS } from "./useAuth.js";

export function useSpeechVoiceLibrary() {
  const queryClient = useQueryClient();
  const setUserSettings = useChatStore((state) => state.setUserSettings);

  const refreshSettings = async () => {
    await authService.checkAuthStatus();
    setUserSettings(authService.getUserSettings());
    await queryClient.invalidateQueries({ queryKey: AUTH_QUERY_KEYS.authStatus });
  };

  const createMutation = useMutation({
    mutationFn: speechVoicesService.create,
    onSuccess: refreshSettings,
  });
  const deleteMutation = useMutation({
    mutationFn: speechVoicesService.delete,
    onSuccess: refreshSettings,
  });

  return {
    createVoice: createMutation.mutateAsync,
    deleteVoice: deleteMutation.mutateAsync,
    isCreatingVoice: createMutation.isPending,
    isDeletingVoice: deleteMutation.isPending,
  };
}
