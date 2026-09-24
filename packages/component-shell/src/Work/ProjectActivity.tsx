import { ProjectActivityList } from "@ngriffin_uk/polychat-component-workspaces";
import { useActivity } from "@ngriffin_uk/polychat-library-react";

import { PageShell } from "../Shell/PageShell.js";
import { ProjectHomeHeader } from "./ProjectHomeHeader.js";
export function ProjectActivity({
  workspaceId,
  projectId,
}: {
  workspaceId: string;
  projectId: string;
}) {
  const {
    data: activities,
    isLoading,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useActivity(projectId);

  return (
    <PageShell.Content className="max-w-6xl">
      <ProjectHomeHeader workspaceId={workspaceId} projectId={projectId} />

      <ProjectActivityList
        activities={activities ?? []}
        isLoading={isLoading}
        errorMessage={error?.message}
        hasMore={hasNextPage}
        isLoadingMore={isFetchingNextPage}
        onLoadMore={() => void fetchNextPage()}
      />
    </PageShell.Content>
  );
}
