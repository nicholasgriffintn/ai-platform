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
  children,
}: {
  conversationId: string;
  workbench: ConversationWorkbenchContext;
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
      {workbench.artifacts.length > 0 ? (
        <ConversationOutputsCard conversationId={conversationId} artifacts={workbench.artifacts} />
      ) : null}
      {children}
      <ConversationUsageCard summary={workbench.usage} runUsage={workbench.runUsage} />
    </>
  );
}
