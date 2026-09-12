import type {
  Delegation,
  DelegationOutputReference,
  DelegationTeammateReference,
} from "@ngriffin_uk/polychat-schemas";
import { isLiveDelegationState } from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/lib/context/serviceContext";
import { filterAccessibleOutputs } from "~/services/outputs/access";

import { canControlAnyDelegation } from "./authority";

async function resolveOutputReferences(
  context: ServiceContext,
  delegations: readonly Delegation[],
  userId: number,
): Promise<DelegationOutputReference[]> {
  const outputIds = [
    ...new Set(delegations.flatMap((delegation) => delegation.result?.outputIds ?? [])),
  ];
  const records = await context.repositories.outputs.getOutputsByIds(outputIds);
  const outputs = await filterAccessibleOutputs(context, userId, records);

  return outputs.map((output): DelegationOutputReference => ({
    id: output.id,
    title: output.title,
    kind: output.kind,
    status: output.status,
  }));
}

async function resolveTeammateReferences(
  context: ServiceContext,
  delegations: readonly Delegation[],
): Promise<DelegationTeammateReference[]> {
  const teammateIds = [...new Set(delegations.map((delegation) => delegation.teammateId))];
  const teammates = await context.repositories.teammates.getTeammatesByIds(teammateIds);

  return teammates.map((teammate) => ({
    id: teammate.id,
    name: teammate.name,
    avatarUrl: teammate.avatar_url,
  }));
}

export async function listDelegationsWithReferences(
  context: ServiceContext,
  parentConversationId: string,
): Promise<{
  delegations: Delegation[];
  teammates: DelegationTeammateReference[];
  outputs: DelegationOutputReference[];
  canControl: boolean;
}> {
  const user = context.requireUser();
  const delegations =
    await context.repositories.delegations.listByParentConversationId(parentConversationId);
  const [teammates, outputs, canControl] = await Promise.all([
    resolveTeammateReferences(context, delegations),
    resolveOutputReferences(context, delegations, user.id),
    canControlAnyDelegation(
      context,
      delegations.filter((delegation) => isLiveDelegationState(delegation.state)),
      user.id,
    ),
  ]);

  return { delegations, teammates, outputs, canControl };
}
