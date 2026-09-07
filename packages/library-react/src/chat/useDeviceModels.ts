import { deviceModelSource } from "@ngriffin_uk/polychat-library-chat";
import type { ModelConfig } from "@ngriffin_uk/polychat-schemas";
import { useQuery } from "@tanstack/react-query";

export const DEVICE_MODELS_QUERY_KEY = "device-models";

export function useDeviceModels() {
  const source = deviceModelSource();

  return useQuery({
    queryKey: [DEVICE_MODELS_QUERY_KEY],
    queryFn: (): Promise<ModelConfig> => source?.() ?? Promise.resolve({}),
    enabled: Boolean(source),
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
  });
}
