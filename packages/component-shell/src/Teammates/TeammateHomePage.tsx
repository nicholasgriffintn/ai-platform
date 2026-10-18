import {
  Button,
  EmptyState,
  PageStatus,
  TeammateCharacter,
} from "@ngriffin_uk/polychat-component-ui";
import {
  getTeammateGroupPath,
  useChat,
  useMarkRosterThreadRead,
  useTeammate,
  useTeammateHome,
  useTeammates,
} from "@ngriffin_uk/polychat-library-react";
import {
  DEFAULT_PET_PRESET_SLUG,
  isPolyTeammateId,
  type TeammateResponse,
} from "@ngriffin_uk/polychat-schemas";
import { TriangleAlert, UserPlus } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router";

import { ConversationWorkbenchLayout } from "../Conversations/ConversationWorkbenchLayout.js";
import { ProductModeHeader } from "../Header/ProductModeHeader.js";
import { CreateTeammateGroupDialog } from "./CreateTeammateGroupDialog.js";
import { getTeammatePagePaths } from "./TeammatePageHeader.js";
import { TeammatePageState } from "./TeammatePageState.js";
import { TeammateRailCard } from "./TeammateRailCard.js";
import { TeammateThread } from "./TeammateThread.js";

export interface TeammateHomePageProps {
  teammateId: string;
  teammatesPath: string;
  backPath: string;
  projectId?: string;
}

function TeammateHome({
  teammate,
  teammatesPath,
  projectId,
}: {
  teammate: TeammateResponse;
  teammatesPath: string;
  projectId?: string;
}) {
  const navigate = useNavigate();
  const home = useTeammateHome(teammate.id, projectId);
  const homeConversationId = home.context?.homeConversationId;
  const { data: homeConversation } = useChat(homeConversationId);
  const { teammates } = useTeammates();
  const [addingTeammate, setAddingTeammate] = useState(false);
  const paths = getTeammatePagePaths(teammatesPath, teammate.id);
  const canAddTeammate =
    !projectId &&
    teammates.some((candidate) => candidate.id !== teammate.id && !isPolyTeammateId(candidate.id));

  useMarkRosterThreadRead(homeConversationId);

  if (home.error) {
    return (
      <EmptyState
        icon={<TriangleAlert size={22} className="text-muted-foreground" />}
        title="Could not open this conversation"
        message="Something went wrong on our side. Try again in a moment."
        action={
          <Button type="button" variant="outline" size="sm" onClick={home.retry}>
            Try again
          </Button>
        }
        className="m-4 min-h-[320px] sm:m-8"
      />
    );
  }

  if (!home.context || !homeConversationId) {
    return <PageStatus message={`Opening ${teammate.name}…`} className="h-full min-h-[320px]" />;
  }

  return (
    <>
      <ConversationWorkbenchLayout
        conversationId={homeConversationId}
        conversationMessages={homeConversation?.messages}
        contextRail={
          <TeammateRailCard
            teammateId={teammate.id}
            context={home.context}
            projectId={projectId}
            settingsPath={paths.settingsPath}
            contextPath={paths.contextPath}
          />
        }
        renderHeader={(actions) => (
          <ProductModeHeader
            showProductModeSwitch={false}
            context={
              <div className="flex min-w-0 items-center gap-2">
                <TeammateCharacter
                  characterId={teammate.character_id ?? DEFAULT_PET_PRESET_SLUG}
                  teammateId={teammate.id}
                  name={teammate.name}
                  size={24}
                />
                <h1 className="truncate text-sm font-medium text-foreground">{teammate.name}</h1>
              </div>
            }
            actions={
              <div className="flex shrink-0 items-center gap-0.5">
                {canAddTeammate ? (
                  <Button
                    type="button"
                    variant="icon"
                    onClick={() => setAddingTeammate(true)}
                    title="Add a teammate"
                    aria-label="Add a teammate"
                  >
                    <UserPlus className="size-4" />
                  </Button>
                ) : null}
                {actions}
              </div>
            }
          />
        )}
      >
        <TeammateThread
          key={homeConversationId}
          teammate={teammate}
          conversationId={homeConversationId}
          projectId={projectId}
        />
      </ConversationWorkbenchLayout>
      <CreateTeammateGroupDialog
        open={addingTeammate}
        onOpenChange={setAddingTeammate}
        includedTeammateIds={[teammate.id]}
        onCreated={(group) => {
          setAddingTeammate(false);
          void navigate(getTeammateGroupPath(group.conversationId));
        }}
      />
    </>
  );
}

export function TeammateHomePage({
  teammateId,
  teammatesPath,
  backPath,
  projectId,
}: TeammateHomePageProps) {
  const teammateQuery = useTeammate(teammateId);

  return (
    <TeammatePageState
      noun="teammate"
      isLoading={teammateQuery.isLoading}
      error={teammateQuery.error}
      isFound={Boolean(teammateQuery.data)}
      backPath={backPath}
      onRetry={() => void teammateQuery.refetch()}
    >
      {teammateQuery.data ? (
        <TeammateHome
          teammate={teammateQuery.data}
          teammatesPath={teammatesPath}
          projectId={projectId}
        />
      ) : null}
    </TeammatePageState>
  );
}
