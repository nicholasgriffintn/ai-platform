import { isLiveDelegationState, type Delegation } from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/lib/context/serviceContext";
import { withThreadLockIfFree } from "~/services/conversations/coordinator/client";
import { filterAccessibleOutputs } from "~/services/outputs/access";
import type { IUser } from "~/types";
import { conversationHandleIdForDelegation } from "~/utils/conversation-handles";
import { AssistantError, ErrorType } from "~/utils/errors";
import { generateId } from "~/utils/id";

import { canControlDelegation } from "./authority";

export async function deliverDelegationMessage(
  context: ServiceContext,
  delegationId: string,
  message: string,
  childConversationId?: string,
): Promise<boolean> {
  const user = context.requireUser();
  const delegation = await context.repositories.delegations.getById(delegationId);
  const handle = await context.repositories.conversationHandles.getUsableHandle(
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
    !(await context.repositories.workspaces.canAccessConversation(handle.conversationId, user.id))
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
      await context.repositories.messages.createMessage(
        generateId(),
        handle.conversationId,
        "assistant",
        message,
        {
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
        },
      );
      await context.repositories.conversations.markUnreadForUser(handle.conversationId, user.id);

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

  const parent = await context.repositories.conversations.getConversation(
    delegation.parentConversationId,
  );
  const child = await context.repositories.conversations.getConversation(
    delegation.childConversationId,
  );

  const [canAccessParent, canAccessChild, isInitiator] = await Promise.all([
    context.repositories.workspaces.canAccessConversation(delegation.parentConversationId, user.id),
    context.repositories.workspaces.canAccessConversation(delegation.childConversationId, user.id),
    canControlDelegation(context, delegation, user.id),
  ]);

  if (!parent || !child || !isInitiator || !canAccessParent || !canAccessChild) {
    throw new Error("Delegation delivery scope changed before presentation");
  }

  const outputs = await context.repositories.outputs.getOutputsByIds(delegation.result.outputIds);
  const accessibleOutputs = await filterAccessibleOutputs(context, user.id, outputs);

  const project =
    typeof parent.project_id === "string"
      ? await context.repositories.workspaces.getProject(parent.project_id)
      : null;
  const resultPath = project
    ? `/work/${encodeURIComponent(project.workspace_id)}/projects/${encodeURIComponent(project.id)}/chat/${encodeURIComponent(delegation.childConversationId)}`
    : `/chat/${encodeURIComponent(delegation.childConversationId)}`;
  const heading = delegation.state === "done" ? "Delegation completed" : "Delegation stopped";

  await context.repositories.messages.createProjectedMessage(delegation.parentConversationId, {
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
  await context.repositories.conversations.markUnreadForUser(
    delegation.parentConversationId,
    user.id,
  );
}
