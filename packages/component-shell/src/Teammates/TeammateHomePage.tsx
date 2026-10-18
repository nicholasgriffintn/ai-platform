import {
  BackLink,
  Button,
  Card,
  FormLoadingSkeleton,
  TeammateCharacter,
} from "@ngriffin_uk/polychat-component-ui";
import { getComputerObservations } from "@ngriffin_uk/polychat-library-chat/tool-results";
import { isAuthenticationError } from "@ngriffin_uk/polychat-library-client";
import {
  getTeammateGroupPath,
  useChat,
  useMarkRosterThreadRead,
  useTeammate,
  useTeammateHome,
  useTeammates,
  useTeammatePresence,
} from "@ngriffin_uk/polychat-library-react";
import { DEFAULT_PET_PRESET_SLUG, isPolyTeammateId } from "@ngriffin_uk/polychat-schemas";
import { getErrorMessage } from "@ngriffin_uk/polychat-utility-core";
import { MonitorPlay, PanelRight, UserPlus } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router";

import { SignInEmptyState } from "../Account/SignInEmptyState.js";
import { WorkbenchComputerPreview } from "../Work/WorkbenchComputerPreview.js";
import { CreateTeammateGroupDialog } from "./CreateTeammateGroupDialog.js";
import { TeammateDetailsPanel } from "./TeammateDetailsPanel.js";
import { getTeammatePagePaths } from "./TeammatePageHeader.js";
import { TeammateThread } from "./TeammateThread.js";

export interface TeammateHomePageProps {
  teammateId: string;
  teammatesPath: string;
  backPath: string;
  backLabel: string;
  projectId?: string;
}

export function TeammateHomePage({
  teammateId,
  teammatesPath,
  backPath,
  backLabel,
  projectId,
}: TeammateHomePageProps) {
  const teammateQuery = useTeammate(teammateId);
  const home = useTeammateHome(teammateId, projectId);
  const presence = useTeammatePresence(teammateId);
  const [panel, setPanel] = useState<"details" | "screen" | null>(null);
  const [addingTeammate, setAddingTeammate] = useState(false);
  const navigate = useNavigate();
  const { teammates } = useTeammates();
  const hasOtherTeammates = teammates.some(
    (candidate) => candidate.id !== teammateId && !isPolyTeammateId(candidate.id),
  );
  const { data: homeConversation } = useChat(home.context?.homeConversationId);

  useMarkRosterThreadRead(home.context?.homeConversationId);
  const observations = getComputerObservations(homeConversation?.messages);
  const togglePanel = (next: "details" | "screen") => setPanel(panel === next ? null : next);
  const paths = getTeammatePagePaths(teammatesPath, teammateId);

  if (teammateQuery.isLoading) {
    return <FormLoadingSkeleton />;
  }

  if (isAuthenticationError(teammateQuery.error)) {
    return (
      <SignInEmptyState
        title="Sign in to work with teammates"
        message="Sign in to message your teammates and keep their work in one place."
        className="mx-4 my-8 min-h-[300px]"
      />
    );
  }

  const teammate = teammateQuery.data;

  if (teammateQuery.error || !teammate) {
    return (
      <div className="mx-auto max-w-xl px-6">
        <Card className="p-8 text-center shadow-none">
          <h1 className="text-2xl font-bold text-foreground">Teammate unavailable</h1>
          <p className="text-sm leading-6 text-muted-foreground">
            This teammate no longer exists, or it is not yours to open.
          </p>
          <BackLink href={backPath} label={backLabel} />
        </Card>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex items-center gap-3 border-b border-border px-4 py-2.5">
        <TeammateCharacter
          characterId={teammate.character_id ?? DEFAULT_PET_PRESET_SLUG}
          teammateId={teammate.id}
          name={teammate.name}
          size={32}
        />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-sm font-semibold text-foreground">{teammate.name}</h1>
          <p className="truncate text-xs text-muted-foreground" aria-live="polite">
            {presence.status}
          </p>
        </div>
        {hasOtherTeammates && !projectId ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setAddingTeammate(true)}
            icon={<UserPlus className="size-4" />}
          >
            Add a teammate
          </Button>
        ) : null}
        {observations.length > 0 ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-pressed={panel === "screen"}
            onClick={() => togglePanel("screen")}
            icon={<MonitorPlay className="size-4" />}
          >
            Screen
          </Button>
        ) : null}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-pressed={panel === "details"}
          onClick={() => togglePanel("details")}
          icon={<PanelRight className="size-4" />}
        >
          Details
        </Button>
      </header>
      <div className="relative flex min-h-0 flex-1">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          {home.context ? (
            <TeammateThread
              key={home.context.homeConversationId}
              teammate={teammate}
              conversationId={home.context.homeConversationId}
              projectId={projectId}
            />
          ) : home.error ? (
            <p role="alert" className="p-6 text-sm text-destructive">
              {getErrorMessage(home.error, "Could not open this teammate’s conversation.")}
            </p>
          ) : (
            <FormLoadingSkeleton />
          )}
        </div>
        {panel === "screen" && observations.length > 0 ? (
          <div className="absolute inset-0 z-10 w-full overflow-y-auto border-l border-border bg-surface p-4 md:static md:w-[28rem] md:shrink-0">
            <WorkbenchComputerPreview observations={observations} />
          </div>
        ) : null}
        {panel === "details" && home.context ? (
          <div className="absolute inset-0 z-10 w-full md:static md:w-[24rem] md:shrink-0">
            <TeammateDetailsPanel
              context={home.context}
              projectId={projectId}
              settingsPath={paths.settingsPath}
              isUpdating={home.updateStatus.isPending}
              onStatusChange={(status) => {
                if (home.context) {
                  home.updateStatus.mutate({ contextId: home.context.id, status });
                }
              }}
              onClose={() => setPanel(null)}
            />
          </div>
        ) : null}
      </div>
      <CreateTeammateGroupDialog
        open={addingTeammate}
        onOpenChange={setAddingTeammate}
        includedTeammateIds={[teammate.id]}
        onCreated={(group) => {
          setAddingTeammate(false);
          void navigate(getTeammateGroupPath(group.conversationId));
        }}
      />
    </div>
  );
}
