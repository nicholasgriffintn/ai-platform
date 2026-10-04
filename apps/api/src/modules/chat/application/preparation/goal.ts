import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import { hasProEntitlement } from "@ngriffin_uk/polychat-library-policy";
import type { Goal } from "@ngriffin_uk/polychat-schemas";

import type { CoreChatOptions } from "~/types";

const logger = getLogger({ prefix: "services/chat/preparation/goal" });

export async function loadActiveGoal(options: CoreChatOptions): Promise<Goal | null> {
  const user = options.context?.user;

  if (!user?.id || !hasProEntitlement(user) || !options.completion_id) {
    return null;
  }

  try {
    return await options.context.repositories.goals.getActiveGoal({
      conversationId: options.completion_id,
    });
  } catch (error) {
    logger.error("Failed to load the active goal", { error });

    return null;
  }
}
