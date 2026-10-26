import { DocumentDiscussion } from "@ngriffin_uk/polychat-component-content";
import {
  getProjectTaskPath,
  useCapabilityCatalog,
  useProject,
  useWorkspace,
} from "@ngriffin_uk/polychat-library-react";
import type { DocumentAnchor } from "@ngriffin_uk/polychat-schemas";

import type { useDocumentDiscussion } from "./useDocumentDiscussion.js";

export function FileDiscussion({
  projectId,
  revision,
  documentBody,
  selection,
  hasUnsavedChanges,
  discussion,
}: {
  projectId: string | null;
  revision: number;
  documentBody: string;
  selection: DocumentAnchor | null;
  hasUnsavedChanges: boolean;
  discussion: ReturnType<typeof useDocumentDiscussion>;
}) {
  const project = useProject(projectId ?? undefined);
  const workspace = useWorkspace(project.data?.workspaceId);
  const capabilityCatalog = useCapabilityCatalog(projectId ?? undefined, {
    enabled: Boolean(projectId),
  });
  const permissions = discussion.comments.data?.permissions;

  return (
    <DocumentDiscussion
      revision={revision}
      documentBody={documentBody}
      selection={selection}
      hasUnsavedChanges={hasUnsavedChanges}
      comments={discussion.comments.data?.comments ?? []}
      teammates={projectId ? (capabilityCatalog.data?.teammates ?? []) : []}
      actorUserId={permissions?.actorUserId}
      authorNames={Object.fromEntries(
        (workspace.data?.members ?? []).map((member) => [
          member.userId,
          member.name || member.email,
        ]),
      )}
      canEditDocument={!discussion.comments.isError && (permissions?.canEditDocument ?? false)}
      canResolveAllThreads={
        !discussion.comments.isError && (permissions?.canResolveAllThreads ?? false)
      }
      isLoading={discussion.comments.isLoading}
      hasMore={discussion.comments.hasNextPage}
      isLoadingMore={discussion.comments.isFetchingNextPage}
      onLoadMore={() => void discussion.comments.fetchNextPage()}
      isSaving={discussion.create.isPending || discussion.resolve.isPending}
      isProposing={discussion.propose.isPending}
      isApplying={discussion.apply.isPending}
      errorMessage={discussion.errorMessage}
      taskHref={
        project.data
          ? (taskId) => getProjectTaskPath(project.data.workspaceId, project.data.id, taskId)
          : undefined
      }
      onComment={(body, parentId, mentionedTeammateId) =>
        discussion.onComment(body, parentId, mentionedTeammateId, selection)
      }
      onResolve={discussion.onResolve}
      onPropose={(instructions) => discussion.onPropose(instructions, selection)}
      onApply={discussion.onApply}
    />
  );
}
