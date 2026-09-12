import {
  isLiveDelegationState,
  type Delegation,
  type DelegationContinuation,
} from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/lib/context/serviceContext";
import { AssistantError, ErrorType } from "~/utils/errors";

type ContinuationIdentity = Pick<
  Delegation,
  "childConversationId" | "continuationMode" | "predecessorDelegationId" | "teammateId"
>;

export function validateDelegationContinuation(
  delegation: ContinuationIdentity,
  predecessor: Delegation | null,
): DelegationContinuation {
  if (delegation.continuationMode === "new") {
    if (delegation.predecessorDelegationId) {
      throw new AssistantError(
        "A new delegation cannot inherit a predecessor",
        ErrorType.CONFLICT_ERROR,
        409,
      );
    }

    return {
      mode: "new",
      strategy: "new",
      predecessorDelegationId: null,
      bindingConversationId: null,
    };
  }

  if (
    !predecessor ||
    predecessor.id !== delegation.predecessorDelegationId ||
    predecessor.teammateId !== delegation.teammateId ||
    isLiveDelegationState(predecessor.state)
  ) {
    throw new AssistantError(
      "The selected teammate conversation is not ready for a follow-up",
      ErrorType.CONFLICT_ERROR,
      409,
    );
  }

  if (delegation.continuationMode === "resume") {
    if (delegation.childConversationId !== predecessor.childConversationId) {
      throw new AssistantError(
        "A continued delegation must retain its authorised conversation binding",
        ErrorType.CONFLICT_ERROR,
        409,
      );
    }

    return {
      mode: "resume",
      strategy: "conversation_history",
      predecessorDelegationId: predecessor.id,
      bindingConversationId: predecessor.childConversationId,
    };
  }

  if (delegation.childConversationId === predecessor.childConversationId) {
    throw new AssistantError(
      "A fresh delegation must use a new conversation binding",
      ErrorType.CONFLICT_ERROR,
      409,
    );
  }

  return {
    mode: "fresh",
    strategy: "brief",
    predecessorDelegationId: predecessor.id,
    bindingConversationId: predecessor.childConversationId,
  };
}

export async function resolveDelegationContinuation(
  context: ServiceContext,
  delegation: ContinuationIdentity,
): Promise<DelegationContinuation> {
  const predecessor = delegation.predecessorDelegationId
    ? await context.repositories.delegations.getById(delegation.predecessorDelegationId)
    : null;

  return validateDelegationContinuation(delegation, predecessor);
}
