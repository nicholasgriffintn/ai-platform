import { ModelRouter } from "~/lib/modelRouter";
import type { Attachment } from "~/types";

/**
 * Chooses one or multiple models based on flags and user request.
 * @param env - The environment variables
 * @param lastMessageText - The last message text
 * @param attachments - The attachments
 * @param budgetConstraint - The budget constraint
 * @param user - The user
 * @param completionId - The completion ID
 * @param requestedModel - The requested model
 * @param useMultiModel - Whether to use multiple models
 * @returns The selected models
 */
export async function selectModels(
  env: any,
  lastMessageText: string,
  attachments: Attachment[],
  budgetConstraint: number | undefined,
  user: any,
  completionId: string,
  requestedModel?: string,
  useMultiModel?: boolean,
): Promise<string[]> {
  if (useMultiModel && !requestedModel) {
    return ModelRouter.selectMultipleModels(
      env,
      lastMessageText,
      attachments,
      budgetConstraint,
      user,
      completionId,
    );
  }
  const model =
    requestedModel ||
    (await ModelRouter.selectModel(
      env,
      lastMessageText,
      attachments,
      budgetConstraint,
      user,
      completionId,
    ));
  return [model];
}
