import type { ToolInteractionHandler } from "@ngriffin_uk/polychat-component-content";
import { DelegationCard } from "@ngriffin_uk/polychat-component-conversation";
import { useCancelDelegations, useDelegations } from "@ngriffin_uk/polychat-library-react";
import { delegationListResponseSchema } from "@ngriffin_uk/polychat-schemas";

export function DelegationTimelineView({
  data,
  onToolInteraction,
}: {
  data: unknown;
  onToolInteraction?: ToolInteractionHandler;
}) {
  const parsed = delegationListResponseSchema.safeParse(data);
  const parentConversationId = parsed.success
    ? parsed.data.delegations[0]?.parentConversationId
    : undefined;
  const parentRunId = parsed.success ? parsed.data.delegations[0]?.parentRunId : undefined;
  const query = useDelegations(parentConversationId ?? "");
  const cancelDelegations = useCancelDelegations();
  const delegations = (
    query.data?.delegations ?? (parsed.success ? parsed.data.delegations : [])
  ).filter((delegation) => delegation.parentRunId === parentRunId);
  const first = delegations[0];

  if (!first) {
    return null;
  }

  return (
    <DelegationCard
      delegations={delegations}
      onStopAll={
        query.data?.canControl
          ? () => {
              void cancelDelegations.mutateAsync(first.parentConversationId);
            }
          : undefined
      }
      onOpenDelegation={
        onToolInteraction
          ? (delegation) =>
              void onToolInteraction("delegate", "useAsPrompt", {
                action: "open",
                childConversationId: delegation.childConversationId,
              })
          : undefined
      }
    />
  );
}
