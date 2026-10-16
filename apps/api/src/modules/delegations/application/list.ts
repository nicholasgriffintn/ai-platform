import {
  isLiveDelegationState,
  listPageOf,
  type Delegation,
  type DelegationOutputReference,
  type DelegationTeammateReference,
  type ListPage,
} from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { DelegationRepository } from "~/modules/delegations/infrastructure/DelegationRepository";
import { filterAccessibleOutputs } from "~/modules/outputs/application/access";
import { OutputRepository } from "~/modules/outputs/infrastructure/OutputRepository";
import { TeammateRepository } from "~/modules/teammates/infrastructure/TeammateRepository";

import { canControlAnyDelegation } from "./authority";

async function resolveOutputReferences(
  context: ServiceContext,
  delegations: readonly Delegation[],
  userId: number,
): Promise<DelegationOutputReference[]> {
  const outputIds = [
    ...new Set(delegations.flatMap((delegation) => delegation.result?.outputIds ?? [])),
  ];
  const records = await context.repositories.get(OutputRepository).getOutputsByIds(outputIds);
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
  const teammates = await context.repositories
    .get(TeammateRepository)
    .getTeammatesByIds(teammateIds);

  return teammates.map((teammate) => ({
    id: teammate.id,
    name: teammate.name,
    avatarUrl: teammate.avatar_url,
  }));
}

export async function listDelegationsWithReferences(
  context: ServiceContext,
  parentConversationId: string,
): Promise<
  ListPage<Delegation> & {
    teammates: DelegationTeammateReference[];
    outputs: DelegationOutputReference[];
    canControl: boolean;
  }
> {
  const user = context.requireUser();
  const delegations = await context.repositories
    .get(DelegationRepository)
    .listByParentConversationId(parentConversationId);
  const [teammates, outputs, canControl] = await Promise.all([
    resolveTeammateReferences(context, delegations),
    resolveOutputReferences(context, delegations, user.id),
    canControlAnyDelegation(
      context,
      delegations.filter((delegation) => isLiveDelegationState(delegation.state)),
      user.id,
    ),
  ]);

  return {
    ...listPageOf(delegations, (delegation) => delegation.id),
    teammates,
    outputs,
    canControl,
  };
}
