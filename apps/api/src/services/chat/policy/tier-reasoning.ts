import type { ReasoningEffort } from "@ngriffin_uk/polychat-schemas";

import type { CoreChatOptions } from "~/types";

export function applyTierReasoningEffort(
  options: CoreChatOptions,
  tierEffort: ReasoningEffort | undefined,
): CoreChatOptions {
  if (!tierEffort || options.reasoning_effort || options.reasoning?.effort) {
    return options;
  }

  return { ...options, reasoning_effort: tierEffort };
}
