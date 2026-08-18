import {
  getModelToolOptions,
  type ModelToolModelCapabilities,
  type ModelToolOption,
} from "@ngriffin_uk/polychat-library-chat/model-tools";
import { useMemo } from "react";

import { useCapabilityCatalog } from "./useCapabilityCatalog";

export function useModelToolOptions(
  modelCapabilities: ModelToolModelCapabilities | undefined,
): ModelToolOption[] {
  const { data: catalog } = useCapabilityCatalog();

  return useMemo(
    () => getModelToolOptions(modelCapabilities, catalog?.modelTools ?? []),
    [catalog?.modelTools, modelCapabilities],
  );
}
