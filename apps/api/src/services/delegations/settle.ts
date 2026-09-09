import {
  isLiveDelegationState,
  type Delegation,
  type DelegationResult,
  type DelegationState,
} from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/lib/context/serviceContext";
import { publishDelegationChanged } from "~/services/sync/conversation-events";
import { conversationHandleIdForDelegation } from "~/utils/conversation-handles";

export async function transitionDelegation(
  context: ServiceContext,
  id: string,
  state: DelegationState,
  result: DelegationResult | null = null,
): Promise<Delegation | null> {
  const updated = await context.repositories.delegations.updateState(id, state, result);

  if (!updated) {
    return null;
  }

  if (!isLiveDelegationState(state)) {
    await context.repositories.conversationHandles.revoke(
      conversationHandleIdForDelegation(id),
      id,
      new Date().toISOString(),
    );
  }

  await publishDelegationChanged(context, updated);

  return updated;
}
