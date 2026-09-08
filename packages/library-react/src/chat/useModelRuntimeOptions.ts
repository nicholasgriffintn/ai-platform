import { desktopExecutionBackend, deviceModelSource } from "@ngriffin_uk/polychat-library-chat";
import type { ModelConfig } from "@ngriffin_uk/polychat-schemas";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { buildModelRuntimeOptions } from "../lib/model-runtime-options.js";
import { useMachines } from "./useMachines.js";
export { buildModelRuntimeOptions, type ModelRuntimeOption } from "../lib/model-runtime-options.js";

export const MODEL_RUNTIME_OPTIONS_QUERY_KEY = "model-runtime-options";

export function useModelRuntimeOptions(models: ModelConfig) {
  const backend = desktopExecutionBackend();
  const machines = useMachines({ enabled: !backend });
  const runtimeQuery = useQuery({
    queryKey: [MODEL_RUNTIME_OPTIONS_QUERY_KEY],
    queryFn: () => (backend ? backend.listEndpoints() : Promise.resolve([])),
    enabled: Boolean(backend),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const includeBrowser = !deviceModelSource();
  const options = useMemo(
    () => buildModelRuntimeOptions(models, runtimeQuery.data, machines.data, includeBrowser),
    [models, runtimeQuery.data, machines.data, includeBrowser],
  );

  return { options, refresh: runtimeQuery.refetch };
}
