import type { SubmitChatCompletionFeedbackInput } from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { handleChatCompletionFeedbackSubmission } from "~/modules/completions/application/chatCompletionFeedbackSubmission";

import { ConversationManager } from "./manager";

export async function submitConversationFeedback(
  context: ServiceContext,
  completionId: string,
  request: SubmitChatCompletionFeedbackInput,
) {
  const user = context.requireUser();

  context.ensureDatabase();
  const conversationManager = ConversationManager.getInstance({
    database: context.database,
    user,
  });
  const conversation = await conversationManager.getConversationDetails(completionId);
  const messages = conversation.messages.flatMap((message) =>
    message.id
      ? [
          {
            id: message.id,
            role: message.role,
            log_id: message.log_id,
            run_id: message.run_id,
          },
        ]
      : [],
  );

  return handleChatCompletionFeedbackSubmission(
    {
      env: context.env,
      user,
      anonymousUser: context.anonymousUser,
      messages,
      repositories: context.repositories,
    },
    { request, completion_id: completionId },
  );
}
