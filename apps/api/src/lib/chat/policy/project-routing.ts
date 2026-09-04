import type { ModelRouterMode } from "@ngriffin_uk/polychat-schemas";

import { resolveChatProjectAccess } from "~/services/workspaces/chatProjectAccess";
import type { CoreChatOptions } from "~/types";

export async function resolveProjectRouterMode(
  options: Pick<
    CoreChatOptions,
    "context" | "completion_id" | "metadata" | "model_router_mode" | "model" | "models"
  >,
): Promise<ModelRouterMode> {
  const requestedMode = options.model_router_mode ?? "auto";

  if (options.model || options.models?.length || !options.context) {
    return requestedMode;
  }

  const access = await resolveChatProjectAccess(options.context, options);

  return requestedMode === "auto" ? (access?.project.default_router_mode ?? "auto") : requestedMode;
}
