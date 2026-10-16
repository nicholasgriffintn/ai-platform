import {
  isLiveDelegationState,
  type Delegation,
  type DelegationResult,
  type DelegationState,
} from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { conversationHandleIdForDelegation } from "~/modules/conversations/application/conversation-handles";
import { ConversationHandleRepository } from "~/modules/conversations/infrastructure/ConversationHandleRepository";
import { DelegationRepository } from "~/modules/delegations/infrastructure/DelegationRepository";
import { publishDelegationChanged } from "~/modules/sync/application/conversation-events";

export async function transitionDelegation(
  context: ServiceContext,
  id: string,
  state: DelegationState,
  result: DelegationResult | null = null,
  deliveryUserId?: number,
): Promise<Delegation | null> {
  const updated = await context.repositories
    .get(DelegationRepository)
    .updateState(id, state, result, deliveryUserId);

  if (!updated) {
    return null;
  }

  if (!isLiveDelegationState(state)) {
    await context.repositories
      .get(ConversationHandleRepository)
      .revoke(conversationHandleIdForDelegation(id), id, new Date().toISOString());
  }

  await publishDelegationChanged(context, updated);

  return updated;
}
