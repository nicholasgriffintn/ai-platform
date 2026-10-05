import { DocumentDiscussion } from "@ngriffin_uk/polychat-component-content";
import {
  getProjectBasePath,
  useCapabilityCatalog,
  useProject,
  useWorkspace,
} from "@ngriffin_uk/polychat-library-react";
import type { DocumentAnchor, Output } from "@ngriffin_uk/polychat-schemas";

import type { useDocumentDiscussion } from "./useDocumentDiscussion.js";

export function DocumentOutputDiscussion({
  output,
  documentBody,
  selection,
  hasUnsavedChanges,
  discussion,
}: {
  output: Output;
  documentBody: string;
  selection: DocumentAnchor | null;
  hasUnsavedChanges: boolean;
  discussion: ReturnType<typeof useDocumentDiscussion>;
}) {
  const project = useProject(output.projectId ?? undefined);
  const workspace = useWorkspace(project.data?.workspaceId);
  const capabilityCatalog = useCapabilityCatalog(output.projectId ?? undefined, {
    enabled: Boolean(output.projectId),
  });
  const permissions = discussion.comments.data?.permissions;

  return (
    <DocumentDiscussion
      revision={output.revision}
      documentBody={documentBody}
      selection={selection}
      hasUnsavedChanges={hasUnsavedChanges}
      comments={discussion.comments.data?.comments ?? []}
      teammates={output.projectId ? (capabilityCatalog.data?.teammates ?? []) : []}
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
          ? (taskId) =>
              `${getProjectBasePath(project.data.workspaceId, project.data.id)}/tasks/${encodeURIComponent(taskId)}`
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
