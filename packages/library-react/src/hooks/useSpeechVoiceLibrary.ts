import {
  authService,
  speechVoicesService,
  useChatStore,
} from "@ngriffin_uk/polychat-library-client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { AUTH_QUERY_KEYS } from "./useAuth.js";

const SPEECH_MODELS_QUERY_KEY = ["speech-models"];

export function useSpeechModels(enabled: boolean) {
  return useQuery({
    queryKey: SPEECH_MODELS_QUERY_KEY,
    queryFn: speechVoicesService.listModels,
    enabled,
    staleTime: 1000 * 60 * 5,
  });
}

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
