import { BackLink, Card, FormLoadingSkeleton } from "@ngriffin_uk/polychat-component-ui";
import { isAuthenticationError } from "@ngriffin_uk/polychat-library-client";
import { useTeammate } from "@ngriffin_uk/polychat-library-react";

import { SignInEmptyState } from "../Account/SignInEmptyState.js";
import { TeammateContextsPanel } from "./TeammateContextsPanel.js";
import { getTeammatePagePaths, TeammatePageHeader } from "./TeammatePageHeader.js";

export interface TeammateWorkingContextPageProps {
  teammateId: string;
  teammatesPath: string;
  backPath: string;
  backLabel: string;
  projectId?: string;
}

export function TeammateWorkingContextPage({
  teammateId,
  teammatesPath,
  backPath,
  backLabel,
  projectId,
}: TeammateWorkingContextPageProps) {
  const teammateQuery = useTeammate(teammateId);
  const pagePaths = getTeammatePagePaths(teammatesPath, teammateId);

  if (teammateQuery.isLoading) {
    return <FormLoadingSkeleton />;
  }

  if (isAuthenticationError(teammateQuery.error)) {
    return (
      <SignInEmptyState
        title="Sign in to manage working context"
        message="Sign in to manage a teammate’s ongoing work, memory and access."
        className="mx-4 my-8 min-h-[300px]"
      />
    );
  }

  if (teammateQuery.error || !teammateQuery.data) {
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

  const teammate = teammateQuery.data;

  return (
    <div className="mx-auto max-w-5xl px-6 md:px-10">
      <TeammatePageHeader
        backPath={backPath}
        backLabel={backLabel}
        teammateName={teammate.name}
        teammatePath={pagePaths.editorPath}
        contextPath={pagePaths.contextPath}
        activeSection="context"
        description="Keep this teammate’s ongoing work, memory, connections and computer in one place."
      />

      <TeammateContextsPanel
        teammateId={teammate.id}
        projectId={projectId}
        conversationPath={(conversationId) =>
          projectId
            ? `${backPath.replace(/\/teammates\/?$/u, "")}/chat/${conversationId}`
            : `/chat/${conversationId}`
        }
      />
    </div>
  );
}
