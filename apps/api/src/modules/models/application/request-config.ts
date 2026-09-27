import { memoizeRequest } from "@ngriffin_uk/polychat-utility-server/request-cache";

import type { CoreChatOptions } from "~/types";

import { findModelConfig } from "./resolve";

export function resolveRequestModelConfig(
  options: Pick<CoreChatOptions, "context" | "env">,
  model: string,
  provider?: string,
) {
  const userId = options.context?.user?.id;

  return memoizeRequest(
    options.context?.requestCache,
    JSON.stringify(["model-config", userId ?? null, provider ?? null, model]),
    () => findModelConfig(model, options.env, provider, userId),
  );
}
