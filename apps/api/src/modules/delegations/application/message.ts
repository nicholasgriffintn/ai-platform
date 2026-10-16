import { isLiveDelegationState, type Delegation } from "@ngriffin_uk/polychat-schemas";
import { generateId } from "@ngriffin_uk/polychat-utility-core";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { conversationHandleIdForDelegation } from "~/modules/conversations/application/conversation-handles";
import { ConversationHandleRepository } from "~/modules/conversations/infrastructure/ConversationHandleRepository";
import { ConversationRepository } from "~/modules/conversations/infrastructure/ConversationRepository";
import { withThreadLockIfFree } from "~/modules/conversations/infrastructure/coordinator/client";
import { MessageRepository } from "~/modules/conversations/infrastructure/MessageRepository";
import { DelegationRepository } from "~/modules/delegations/infrastructure/DelegationRepository";
import { filterAccessibleOutputs } from "~/modules/outputs/application/access";
import { OutputRepository } from "~/modules/outputs/infrastructure/OutputRepository";
import { WorkspaceRepository } from "~/modules/workspaces/infrastructure/WorkspaceRepository";
import type { IUser } from "~/types";

import { canControlDelegation } from "./authority";

export async function deliverDelegationMessage(
  context: ServiceContext,
  delegationId: string,
  message: string,
  childConversationId?: string,
): Promise<boolean> {
  const user = context.requireUser();
  const delegation = await context.repositories.get(DelegationRepository).getById(delegationId);
  const handle = await context.repositories
    .get(ConversationHandleRepository)
    .getUsableHandle(
      conversationHandleIdForDelegation(delegationId),
      delegationId,
      new Date().toISOString(),
    );

  if (
    !delegation ||
    !isLiveDelegationState(delegation.state) ||
    !handle ||
    (childConversationId !== undefined && delegation.childConversationId !== childConversationId)
  ) {
    throw new AssistantError(
      "This delegate has no usable parent handle.",
      ErrorType.FORBIDDEN,
      403,
    );
  }

  if (
    !(await context.repositories
      .get(WorkspaceRepository)
      .canAccessConversation(handle.conversationId, user.id))
  ) {
    throw new AssistantError(
      "The parent conversation is no longer accessible.",
      ErrorType.FORBIDDEN,
      403,
    );
  }

  return withThreadLockIfFree(
    { env: context.env, conversationId: handle.conversationId, kind: "user_message" },
    async (lease) => {
      await lease.assertOwned();
      await context.repositories
        .get(MessageRepository)
        .createMessage(generateId(), handle.conversationId, "assistant", message, {
          data: {
            trigger: "handle",
            delegationId: delegation.id,
            teammateId: delegation.teammateId,
          },
          provenance: {
            site: "hosted",
            model: "delegation",
            vendor: delegation.teammateId,
          },
        });
      await context.repositories
        .get(ConversationRepository)
        .markUnreadForUser(handle.conversationId, user.id);

      return true;
    },
  );
}

export async function deliverDelegationResult(
  context: ServiceContext,
  delegation: Delegation,
  user: IUser,
): Promise<void> {
  if (
    !delegation.result ||
    !["done", "failed", "cancelled", "expired"].includes(delegation.state)
  ) {
    return;
  }

  const parent = await context.repositories
    .get(ConversationRepository)
    .getConversation(delegation.parentConversationId);
  const child = await context.repositories
    .get(ConversationRepository)
    .getConversation(delegation.childConversationId);

  const [canAccessParent, canAccessChild, isInitiator] = await Promise.all([
    context.repositories
      .get(WorkspaceRepository)
      .canAccessConversation(delegation.parentConversationId, user.id),
    context.repositories
      .get(WorkspaceRepository)
      .canAccessConversation(delegation.childConversationId, user.id),
    canControlDelegation(context, delegation, user.id),
  ]);

  if (!parent || !child || !isInitiator || !canAccessParent || !canAccessChild) {
    throw new Error("Delegation delivery scope changed before presentation");
  }

  const outputs = await context.repositories
    .get(OutputRepository)
    .getOutputsByIds(delegation.result.outputIds);
  const accessibleOutputs = await filterAccessibleOutputs(context, user.id, outputs);

  const project =
    typeof parent.project_id === "string"
      ? await context.repositories.get(WorkspaceRepository).getProject(parent.project_id)
      : null;
  const resultPath = project
    ? `/work/${encodeURIComponent(project.workspace_id)}/projects/${encodeURIComponent(project.id)}/chat/${encodeURIComponent(delegation.childConversationId)}`
    : `/chat/${encodeURIComponent(delegation.childConversationId)}`;
  const heading = delegation.state === "done" ? "Delegation completed" : "Delegation stopped";

  await context.repositories
    .get(MessageRepository)
    .createProjectedMessage(delegation.parentConversationId, {
      id: `delegation_result_${delegation.id}`,
      role: "assistant",
      content: `**${heading}**\n\n${delegation.result.summary.slice(0, 2000)}\n\n[Open result](${resultPath})`,
      data: {
        platform: "api",
        data: {
          delegationId: delegation.id,
          delegationState: delegation.state,
          outputIds: accessibleOutputs.map((output) => output.id),
        },
      },
    });
  await context.repositories
    .get(ConversationRepository)
    .markUnreadForUser(delegation.parentConversationId, user.id);
}
