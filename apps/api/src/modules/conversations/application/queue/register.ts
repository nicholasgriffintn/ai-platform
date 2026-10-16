import { CONVERSATION_TITLE_TASK_TYPE } from "@ngriffin_uk/polychat-schemas";

import type { AppWorkflows } from "~/modules/queue/application/workflows";

import { asyncMessagePolling } from "./async-message-polling";
import { ConversationTitleHandler } from "./ConversationTitleHandler";

export function registerConversationsQueue(workflows: AppWorkflows): void {
  workflows.register(CONVERSATION_TITLE_TASK_TYPE, new ConversationTitleHandler());
  workflows.poll("async_message_polling", asyncMessagePolling);
}
