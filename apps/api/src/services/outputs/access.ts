import type { ServiceContext } from "~/lib/context/serviceContext";
import type { OutputRecord } from "~/repositories/OutputRepository";
import { requireProjectAccess } from "~/services/workspaces/access";
import { AssistantError, ErrorType } from "~/utils/errors";

export async function requireConversationScope(
  context: ServiceContext,
  userId: number,
  conversationId: string,
  projectId?: string | null,
): Promise<void> {
  const conversation = await context.repositories.conversations.getConversation(conversationId);

  if (!conversation) {
    throw new AssistantError("Conversation not found", ErrorType.NOT_FOUND, 404);
  }

  if (projectId) {
    if (conversation.project_id !== projectId) {
      throw new AssistantError("Conversation is outside this project", ErrorType.PARAMS_ERROR, 400);
    }

    return;
  }

  if (conversation.project_id !== null || conversation.user_id !== userId) {
    throw new AssistantError("Conversation not found", ErrorType.NOT_FOUND, 404);
  }
}

export async function requireOutputAccess(
  context: ServiceContext,
  userId: number,
  outputId: string,
  mutate = false,
): Promise<OutputRecord> {
  const output = await context.repositories.outputs.getOutput(outputId);

  if (!output) {
    throw new AssistantError("Output not found", ErrorType.NOT_FOUND, 404);
  }

  await requireOutputRecordAccess(context, userId, output, mutate);

  return output;
}

export async function requireOutputRecordAccess(
  context: ServiceContext,
  userId: number,
  output: OutputRecord,
  mutate = false,
): Promise<void> {
  if (!output.project_id) {
    if (output.created_by_user_id !== userId) {
      throw new AssistantError("Output not found", ErrorType.NOT_FOUND, 404);
    }

    return;
  }

  const { role } = await requireProjectAccess(context, output.project_id);

  if (mutate && role === "member" && output.created_by_user_id !== userId) {
    throw new AssistantError(
      "Only the output creator or a project admin can change it",
      ErrorType.FORBIDDEN,
      403,
    );
  }
}
