import { buildMachineModels, deviceModelSource } from "@ngriffin_uk/polychat-library-chat";
import { apiService } from "@ngriffin_uk/polychat-library-client";
import type { ModelConfig } from "@ngriffin_uk/polychat-schemas";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { useDeviceModels } from "./useDeviceModels.js";
import { useMachines } from "./useMachines.js";

export const MODELS_QUERY_KEY = "models";

export const MODEL_CATALOGUE_QUERY_KEY = "model-catalogue";

export function useModels() {
  const hostedModels = useQuery({
    queryKey: [MODELS_QUERY_KEY],
    queryFn: apiService.fetchModels,
    staleTime: 1000 * 60,
    gcTime: 1000 * 60 * 60,
    refetchOnMount: "always",
    refetchOnWindowFocus: "always",
  });
  const deviceModels = useDeviceModels();
  const hasLocalDeviceModelSource = Boolean(deviceModelSource());
  const machines = useMachines({ enabled: !hasLocalDeviceModelSource });
  const data = useMemo<ModelConfig | undefined>(() => {
    const machineModels = machines.data ? buildMachineModels(machines.data) : undefined;

    return hostedModels.data || deviceModels.data || machineModels
      ? {
          ...Object.fromEntries(
            Object.entries(hostedModels.data ?? {}).filter(
              ([, model]) => model.kind !== "agent" || model.runsOn !== "device",
            ),
          ),
          ...machineModels,
          ...deviceModels.data,
        }
      : undefined;
  }, [hostedModels.data, deviceModels.data, machines.data]);
  const isMachineQueryActive = !hasLocalDeviceModelSource;

  return {
    ...hostedModels,
    data,
    isLoading:
      data === undefined &&
      (hostedModels.isLoading ||
        deviceModels.isLoading ||
        (isMachineQueryActive && machines.isLoading)),
    isFetching:
      hostedModels.isFetching ||
      deviceModels.isFetching ||
      (isMachineQueryActive && machines.isFetching),
    isError:
      hostedModels.isError || deviceModels.isError || (isMachineQueryActive && machines.isError),
    error:
      hostedModels.error ?? deviceModels.error ?? (isMachineQueryActive ? machines.error : null),
  };
}

export function useModelCatalogue() {
  return useQuery({
    queryKey: [MODEL_CATALOGUE_QUERY_KEY],
    queryFn: apiService.fetchModelCatalogue,
    staleTime: 1000 * 60 * 30,
    gcTime: 1000 * 60 * 60,
  });
}
