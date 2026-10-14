import type { ResponseAuthority } from "@ngriffin_uk/polychat-schemas";

import type { ChatCompletionParameters } from "~/types";

export function authorityOptions(
  authority: ResponseAuthority = {},
): Pick<ChatCompletionParameters, "trigger" | "delegation_context" | "durable_execution"> {
  return {
    ...(authority.trigger ? { trigger: authority.trigger } : {}),
    ...(authority.delegationContext ? { delegation_context: authority.delegationContext } : {}),
    ...(authority.durableExecution ? { durable_execution: authority.durableExecution } : {}),
  };
}
