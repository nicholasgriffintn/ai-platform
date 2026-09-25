import { desktopExecutionBackend } from "@ngriffin_uk/polychat-library-chat";
import { normalizeSelectedModel } from "@ngriffin_uk/polychat-library-chat/model-selection";
import { useChatStore } from "@ngriffin_uk/polychat-library-client";
import { EMPTY_MODEL_CONFIG, runsOnDevice } from "@ngriffin_uk/polychat-schemas";

import { useModels } from "./useModels.js";

export function useSelectedModelRunsOnDevice(): boolean {
  const model = useChatStore((state) => state.model);
  const { data: models = EMPTY_MODEL_CONFIG } = useModels();
  const selected = normalizeSelectedModel(model);
  const config = selected ? models[selected] : undefined;

  return Boolean(config && runsOnDevice(config) && desktopExecutionBackend());
}
