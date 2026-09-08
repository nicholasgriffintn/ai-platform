import { DelegationCard } from "@ngriffin_uk/polychat-component-conversation";
import type { Delegation } from "@ngriffin_uk/polychat-schemas";
import { useState } from "react";

import { DelegatePanel } from "./DelegatePanel.js";

export function ProjectDelegatesPanel({
  delegations,
  canControl,
  onStopAll,
}: {
  delegations: Delegation[];
  canControl: boolean;
  onStopAll: () => void;
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
        onStopAll={canControl ? onStopAll : undefined}
        onOpenDelegation={(delegation) => setSelectedId(delegation.id)}
      />
      <DelegatePanel
        key={selected.id}
        conversationId={selected.childConversationId}
        canControl={canControl}
      />
    </div>
  );
}
