import { ConversationThread } from "@ngriffin_uk/polychat-component-conversation";
import { BackLink, Card, cn, FormLoadingSkeleton } from "@ngriffin_uk/polychat-component-ui";
import { useChatStore } from "@ngriffin_uk/polychat-library-client";
import {
  ArtifactWorkbenchProvider,
  ComposerDraftProvider,
  ConversationScopeProvider,
  useConversationAgentApprovals,
  useLocalComposerDraft,
  useLocalConversationScope,
  useMarkRosterThreadRead,
  useTeammateGroups,
  useTeammates,
} from "@ngriffin_uk/polychat-library-react";
import type { ResponseAgent, TeammateGroup, TeammateResponse } from "@ngriffin_uk/polychat-schemas";
import { useMemo } from "react";

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
  const names = members.map((member) => member.name).join(", ");

  return (
    <ConversationThread
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
        <ArtifactWorkbenchProvider>
          <div className="relative min-h-0 flex-1 overflow-hidden">
            <GroupConversation
              group={group}
              members={members}
              conversationId={scope.currentConversationId ?? group.conversationId}
            />
          </div>
        </ArtifactWorkbenchProvider>
      </ComposerDraftProvider>
    </ConversationScopeProvider>
  );
}

export function TeammateGroupPage({
  conversationId,
  backPath,
  backLabel,
}: {
  conversationId: string;
  backPath: string;
  backLabel: string;
}) {
  const { groups, isLoading } = useTeammateGroups();
  const { teammates } = useTeammates();
  const selectedTeammateId = useChatStore((state) => state.selectedTeammateId);
  const chatMode = useChatStore((state) => state.chatMode);
  const setSelectedTeammateId = useChatStore((state) => state.setSelectedTeammateId);
  const setChatMode = useChatStore((state) => state.setChatMode);
  const group = groups.find((candidate) => candidate.conversationId === conversationId);

  useMarkRosterThreadRead(conversationId);

  if (isLoading) {
    return <FormLoadingSkeleton />;
  }

  if (!group) {
    return (
      <div className="mx-auto max-w-xl px-6">
        <Card className="p-8 text-center shadow-none">
          <h1 className="text-2xl font-bold text-foreground">Group unavailable</h1>
          <p className="text-sm leading-6 text-muted-foreground">
            This group no longer exists, or it is not yours to open.
          </p>
          <BackLink href={backPath} label={backLabel} />
        </Card>
      </div>
    );
  }

  const members = group.teammateIds.flatMap((teammateId) => {
    const member = teammates.find((teammate) => teammate.id === teammateId);

    return member ? [member] : [];
  });
  const recipientId =
    chatMode === "agent" && selectedTeammateId && group.teammateIds.includes(selectedTeammateId)
      ? selectedTeammateId
      : group.teammateIds[0];

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-2.5">
        <TeammateStack members={members} size={28} />
        <h1 className="min-w-0 truncate text-sm font-semibold text-foreground">{group.name}</h1>
        <fieldset className="ml-auto flex flex-wrap gap-1">
          <legend className="sr-only">Reply goes to</legend>
          {members.map((member) => (
            <button
              key={member.id}
              type="button"
              aria-pressed={member.id === recipientId}
              onClick={() => {
                setSelectedTeammateId(member.id);
                setChatMode("agent");
              }}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-0.5 text-xs transition-colors",
                member.id === recipientId
                  ? "border-active-work/40 bg-active-work/10 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              @{member.name}
            </button>
          ))}
        </fieldset>
      </header>
      <GroupThread key={group.conversationId} group={group} members={members} />
    </div>
  );
}
