import type { Delegation, DelegationWaitFor } from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/lib/context/serviceContext";
import { AssistantError, ErrorType } from "~/utils/errors";

const SETTLED_STATES = new Set<Delegation["state"]>(["done", "failed", "cancelled", "expired"]);

export function isDelegationGroupReady(delegations: readonly Delegation[]): boolean {
  const first = delegations[0];

  if (!first || first.waitFor === "none") {
    return false;
  }

  return first.waitFor === "any"
    ? delegations.some((delegation) => SETTLED_STATES.has(delegation.state))
    : delegations.every((delegation) => SETTLED_STATES.has(delegation.state));
}

export async function isRunWaitingForDelegations(
  context: ServiceContext,
  parentRunId: string,
): Promise<boolean> {
  const delegations = await context.repositories.delegations.listByParentRunId(parentRunId);

  return (
    delegations.length > 0 &&
    delegations[0].waitFor !== "none" &&
    !isDelegationGroupReady(delegations)
  );
}

export async function requireDelegationGroupWaitPolicy(
  context: ServiceContext,
  parentRunId: string,
  waitFor: DelegationWaitFor,
): Promise<void> {
  const existing = await context.repositories.delegations.listByParentRunId(parentRunId);
  const conflicting = existing.find((delegation) => delegation.waitFor !== waitFor);

  if (conflicting) {
    throw new AssistantError(
      `All delegations from one response must use the same wait policy (${conflicting.waitFor})`,
      ErrorType.CONFLICT_ERROR,
      409,
    );
  }
}
