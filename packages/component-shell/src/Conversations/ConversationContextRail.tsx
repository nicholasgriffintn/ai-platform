import {
  ContextUsageCard,
  ConversationUsageCard,
} from "@ngriffin_uk/polychat-component-conversation";
import { API_BASE_URL } from "@ngriffin_uk/polychat-library-client";
import type { ReactNode } from "react";

import { ConversationOutputsCard } from "./ConversationOutputsCard.js";
import { ConversationOverviewCard } from "./ConversationOverviewCard.js";
import type { ConversationWorkbenchContext } from "./useConversationWorkbenchContext.js";

export function ConversationContextRail({
  conversationId,
  workbench,
  briefUpdated,
  onOpenBrief,
  children,
}: {
  conversationId: string;
  workbench: ConversationWorkbenchContext;
  briefUpdated: boolean;
  onOpenBrief: () => void;
  children?: ReactNode;
}) {
  return (
    <>
      <ConversationOverviewCard workbench={workbench} />
      <ContextUsageCard
        snapshot={workbench.snapshot}
        fallback={workbench.fallback}
        resolveReferenceHref={(path) => `${API_BASE_URL}${path}`}
      />
      <ConversationOutputsCard
        conversationId={conversationId}
        artifacts={workbench.artifacts}
        briefUpdated={briefUpdated}
        onOpenBrief={onOpenBrief}
      />
      {children}
      <ConversationUsageCard summary={workbench.usage} runUsage={workbench.runUsage} />
    </>
  );
}
