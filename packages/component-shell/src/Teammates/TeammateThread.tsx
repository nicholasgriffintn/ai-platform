import { ConversationSurface } from "@ngriffin_uk/polychat-component-conversation";
import {
  ComposerDraftProvider,
  ConversationScopeProvider,
  useConversationAgentApprovals,
  useLocalComposerDraft,
  useLocalConversationScope,
} from "@ngriffin_uk/polychat-library-react";
import type { ResponseAgent, TeammateResponse } from "@ngriffin_uk/polychat-schemas";
import { useMemo } from "react";

import { useTeammateLiveMode } from "./useTeammateLiveMode.js";

type ThreadTeammate = Pick<TeammateResponse, "id" | "name" | "description">;

function TeammateConversation({
  teammate,
  conversationId,
  projectId,
}: {
  teammate: ThreadTeammate;
  conversationId: string;
  projectId?: string;
}) {
  const agentApprovals = useConversationAgentApprovals(conversationId);
  const liveMode = useTeammateLiveMode(teammate.name);
  const placeholder = `Message ${teammate.name}…`;

  return (
    <ConversationSurface
      header={null}
      modeConfig={{
        surface: "teammate",
        agentApprovals,
        welcomeTitle: teammate.name,
        welcomeDescription:
          teammate.description ||
          "This conversation carries on. Give it one job and it keeps the context.",
        welcomeCapabilitySuggestions: false,
        inputPlaceholder: { newConversation: placeholder, followUp: placeholder },
        analyticsSource: "teammate",
        ...(projectId ? { requestOptions: { metadata: { project_id: projectId } } } : {}),
        ...liveMode,
      }}
    />
  );
}

export function TeammateThread({
  teammate,
  conversationId,
  projectId,
}: {
  teammate: ThreadTeammate;
  conversationId: string;
  projectId?: string;
}) {
  const agent = useMemo<ResponseAgent>(
    () => ({ type: "teammate", id: teammate.id }),
    [teammate.id],
  );
  const scope = useLocalConversationScope(conversationId, undefined, agent);
  const draft = useLocalComposerDraft();

  return (
    <ConversationScopeProvider scope={scope}>
      <ComposerDraftProvider draft={draft}>
        <TeammateConversation
          teammate={teammate}
          conversationId={scope.currentConversationId ?? conversationId}
          projectId={projectId}
        />
      </ComposerDraftProvider>
    </ConversationScopeProvider>
  );
}
