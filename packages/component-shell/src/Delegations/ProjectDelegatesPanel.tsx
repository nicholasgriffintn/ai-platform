import {
  createDelegationFollowUpInteraction,
  DelegationCard,
} from "@ngriffin_uk/polychat-component-conversation";
import type {
  Delegation,
  DelegationOutputReference,
  DelegationTeammateReference,
} from "@ngriffin_uk/polychat-schemas";
import { useState } from "react";

import { DelegatePanel } from "./DelegatePanel.js";

export function ProjectDelegatesPanel({
  delegations,
  canControl,
  onStopAll,
  onFollowUp,
  teammates = [],
  outputs = [],
}: {
  delegations: Delegation[];
  canControl: boolean;
  onStopAll: () => void;
  onFollowUp: (input: string) => void;
  teammates?: DelegationTeammateReference[];
  outputs?: DelegationOutputReference[];
}) {
  const [selectedId, setSelectedId] = useState<string>();
  const selected = delegations.find((delegation) => delegation.id === selectedId) ?? delegations[0];

  if (!selected) {
    return <p className="text-sm text-muted-foreground">No delegated work in this conversation.</p>;
  }

  return (
    <div className="space-y-4">
      <DelegationCard
        delegations={delegations}
        teammates={teammates}
        outputs={outputs}
        onStopAll={canControl ? onStopAll : undefined}
        onOpenDelegation={(delegation) => setSelectedId(delegation.id)}
        onResumeDelegation={
          canControl
            ? (delegation) =>
                onFollowUp(createDelegationFollowUpInteraction(delegation, "resume").input)
            : undefined
        }
        onStartFreshDelegation={
          canControl
            ? (delegation) =>
                onFollowUp(createDelegationFollowUpInteraction(delegation, "fresh").input)
            : undefined
        }
      />
      <DelegatePanel key={selected.id} conversationId={selected.childConversationId} />
    </div>
  );
}
