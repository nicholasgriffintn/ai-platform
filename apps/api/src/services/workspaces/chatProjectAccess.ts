import type { ServiceContext } from "~/lib/context/serviceContext";
import type { CoreChatOptions } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";

import { requireProjectAccess } from "./access";

export async function resolveChatProjectAccess(
  context: ServiceContext,
  options: Pick<CoreChatOptions, "completion_id" | "metadata">,
) {
  const conversation = options.completion_id
    ? await context.repositories.conversations.getConversation(options.completion_id)
    : null;
  const storedProjectId =
    typeof conversation?.project_id === "string" ? conversation.project_id : undefined;
  const requestedProjectId = options.metadata?.project_id;

  if (conversation && !storedProjectId && requestedProjectId) {
    throw new AssistantError(
      "Start a new conversation to work inside a project",
      ErrorType.CONFLICT_ERROR,
      409,
    );
  }

  if (storedProjectId && requestedProjectId && storedProjectId !== requestedProjectId) {
    throw new AssistantError(
      "The conversation belongs to a different project",
      ErrorType.CONFLICT_ERROR,
      409,
    );
  }

  const projectId = storedProjectId ?? requestedProjectId;

  if (!projectId) {
    return null;
  }

  return requireProjectAccess(context, projectId);
}
