import { getDefaultVerbosity } from "@ngriffin_uk/polychat-library-chat/verbosity";
import type { ModelConfigItem } from "@ngriffin_uk/polychat-schemas";
import { getDefaultReasoningEffort } from "@ngriffin_uk/polychat-schemas";

import type { ChatSettings } from "~/types";

export function applyModelResponseDefaults(
  settings: ChatSettings,
  modelConfig?: ModelConfigItem,
): ChatSettings {
  return {
    ...settings,
    reasoning: {
      ...settings.reasoning,
      effort: getDefaultReasoningEffort(modelConfig),
    },
    verbosity: getDefaultVerbosity(modelConfig),
  };
}
