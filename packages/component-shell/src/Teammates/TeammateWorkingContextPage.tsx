import { useTeammate } from "@ngriffin_uk/polychat-library-react";

import { PageShell } from "../Shell/PageShell.js";
import { TeammateContextsPanel } from "./TeammateContextsPanel.js";
import { getTeammatePagePaths, TeammatePageHeader } from "./TeammatePageHeader.js";
import { TeammatePageState } from "./TeammatePageState.js";

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

  const teammate = teammateQuery.data;

  return (
    <TeammatePageState
      noun="teammate"
      isLoading={teammateQuery.isLoading}
      error={teammateQuery.error}
      isFound={Boolean(teammate)}
      backPath={backPath}
      onRetry={() => void teammateQuery.refetch()}
    >
      {teammate ? (
        <PageShell.Content className="max-w-6xl">
          <TeammatePageHeader
            backPath={backPath}
            backLabel={backLabel}
            teammateName={teammate.name}
            paths={pagePaths}
            activeSection="context"
            description="Keep this teammate’s ongoing work, memory, connections and computer in one place."
          />

          <TeammateContextsPanel
            teammateId={teammate.id}
            projectId={projectId}
            conversationHref={pagePaths.homePath}
          />
        </PageShell.Content>
      ) : null}
    </TeammatePageState>
  );
}
