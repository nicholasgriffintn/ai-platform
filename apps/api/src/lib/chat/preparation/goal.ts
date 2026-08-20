import type { Goal } from "@ngriffin_uk/polychat-schemas";

import type { CoreChatOptions } from "~/types";
import { getLogger } from "~/utils/logger";

const logger = getLogger({ prefix: "lib/chat/preparation/goal" });

export async function loadActiveGoal(options: CoreChatOptions): Promise<Goal | null> {
  const user = options.context?.user;

  if (!user?.id || user.plan_id !== "pro" || !options.completion_id) {
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
