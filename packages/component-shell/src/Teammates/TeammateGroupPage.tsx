import { ConversationSurface } from "@ngriffin_uk/polychat-component-conversation";
import {
  ComposerDraftProvider,
  ConversationScopeProvider,
  useChat,
  useConversationAgentApprovals,
  useLocalComposerDraft,
  useLocalConversationScope,
  useMarkRosterThreadRead,
  useTeammateGroups,
  useTeammates,
} from "@ngriffin_uk/polychat-library-react";
import type { ResponseAgent, TeammateGroup, TeammateResponse } from "@ngriffin_uk/polychat-schemas";
import { formatConjunctionList } from "@ngriffin_uk/polychat-utility-core";
import { useMemo } from "react";

import { ConversationWorkbenchLayout } from "../Conversations/ConversationWorkbenchLayout.js";
import { ProductModeHeader } from "../Header/ProductModeHeader.js";
import { TeammatePageState } from "./TeammatePageState.js";
import { TeammateStack } from "./TeammateStack.js";
import { useTeammateLiveMode } from "./useTeammateLiveMode.js";

function GroupConversation({
  group,
  members,
  conversationId,
}: {
  group: TeammateGroup;
  members: readonly TeammateResponse[];
  conversationId: string;
}) {
  const agentApprovals = useConversationAgentApprovals(conversationId);
  const liveMode = useTeammateLiveMode(group.name);
  const names = formatConjunctionList(members.map((member) => member.name));

  return (
    <ConversationSurface
      header={null}
      modeConfig={{
        surface: "group",
        agentApprovals,
        welcomeTitle: group.name,
        welcomeDescription: `${names} share this conversation. Use @name to ask one of them; ${members[0]?.name ?? "the first teammate"} answers otherwise.`,
        welcomeCapabilitySuggestions: false,
        inputPlaceholder: {
          newConversation: "Message the group, or @name someone…",
          followUp: "Reply, or @name someone…",
        },
        analyticsSource: "teammate_group",
        ...(group.projectId
          ? { requestOptions: { metadata: { project_id: group.projectId } } }
          : {}),
        ...liveMode,
      }}
    />
  );
}

function GroupThread({
  group,
  members,
}: {
  group: TeammateGroup;
  members: readonly TeammateResponse[];
}) {
  const leadId = group.teammateIds[0];
  const defaultAgent = useMemo<ResponseAgent | undefined>(
    () => (leadId ? { type: "teammate", id: leadId } : undefined),
    [leadId],
  );
  const scope = useLocalConversationScope(group.conversationId, undefined, undefined, defaultAgent);
  const draft = useLocalComposerDraft();

  return (
    <ConversationScopeProvider scope={scope}>
      <ComposerDraftProvider draft={draft}>
        <GroupConversation
          group={group}
          members={members}
          conversationId={scope.currentConversationId ?? group.conversationId}
        />
      </ComposerDraftProvider>
    </ConversationScopeProvider>
  );
}

export function TeammateGroupPage({
  conversationId,
  backPath,
}: {
  conversationId: string;
  backPath: string;
}) {
  const { groups, isLoading, error, refetch } = useTeammateGroups();
  const group = groups.find((candidate) => candidate.conversationId === conversationId);

  return (
    <TeammatePageState
      noun="group"
      isLoading={isLoading}
      error={error}
      isFound={Boolean(group)}
      backPath={backPath}
      onRetry={() => void refetch()}
    >
      {group ? <GroupHome group={group} /> : null}
    </TeammatePageState>
  );
}

function GroupHome({ group }: { group: TeammateGroup }) {
  const { teammates } = useTeammates();
  const { data: conversation } = useChat(group.conversationId);
  const members = group.teammateIds.flatMap((teammateId) => {
    const member = teammates.find((teammate) => teammate.id === teammateId);

    return member ? [member] : [];
  });

  useMarkRosterThreadRead(group.conversationId);

  return (
    <ConversationWorkbenchLayout
      conversationId={group.conversationId}
      conversationMessages={conversation?.messages}
      renderHeader={(actions) => (
        <ProductModeHeader
          showProductModeSwitch={false}
          context={
            <div className="flex min-w-0 items-center gap-2">
              <TeammateStack members={members} size={22} />
              <h1 className="truncate text-sm font-medium text-foreground">{group.name}</h1>
            </div>
          }
          actions={actions}
        />
      )}
    >
      <GroupThread key={group.conversationId} group={group} members={members} />
    </ConversationWorkbenchLayout>
  );
}
