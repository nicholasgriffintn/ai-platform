import { TeammateEditor, ConfirmDeleteModal } from "@ngriffin_uk/polychat-component-account";
import { NEW_TEAMMATE_ID, useMcpConnections } from "@ngriffin_uk/polychat-library-react";

import { PageShell } from "../Shell/PageShell.js";
import { getTeammatePagePaths, TeammatePageHeader } from "./TeammatePageHeader.js";
import { TeammatePageState } from "./TeammatePageState.js";
import { useTeammateEditorController } from "./useTeammateEditorController.js";

export interface TeammateEditorPageProps {
  teammateId: string;
  teammatesPath: string;
  backPath: string;
  backLabel: string;
  projectId?: string;
  workspaceId?: string;
}

export function TeammateEditorPage({
  teammateId,
  teammatesPath,
  backPath,
  backLabel,
  projectId,
  workspaceId,
}: TeammateEditorPageProps) {
  const mcpConnections = useMcpConnections();
  const controller = useTeammateEditorController({
    teammateId,
    teammatesPath,
    backPath,
    projectId,
    workspaceId,
  });

  const pagePaths = getTeammatePagePaths(teammatesPath, teammateId);

  return (
    <TeammatePageState
      noun="teammate"
      isLoading={controller.isLoading}
      error={controller.loadError}
      isFound={teammateId === NEW_TEAMMATE_ID || Boolean(controller.teammate)}
      backPath={backPath}
      onRetry={controller.retryLoad}
    >
      <PageShell.Content className="max-w-6xl">
        <TeammatePageHeader
          backPath={backPath}
          backLabel={backLabel}
          teammateName={controller.teammate ? controller.teammate.name : "New teammate"}
          paths={controller.teammate ? pagePaths : { settingsPath: pagePaths.settingsPath }}
          activeSection="configuration"
          description="Define what this teammate is, how it behaves, and what it can use."
        />

        <TeammateEditor
          mcpConnections={mcpConnections.query.data}
          teammate={controller.teammate}
          models={controller.models}
          tools={controller.tools}
          skills={controller.skills}
          isLoadingCapabilities={controller.isLoadingCapabilities}
          canManage={controller.canManage}
          cannotManageReason={controller.cannotManageReason}
          isSaving={controller.isSaving}
          error={controller.saveError}
          ownerLabel={controller.ownerLabel}
          publish={controller.publish}
          onSubmit={controller.submit}
          onCancel={controller.cancel}
          onDelete={controller.requestDelete}
        />

        {controller.teammate && (
          <ConfirmDeleteModal
            isOpen={controller.deleteRequested}
            onClose={controller.cancelDelete}
            onConfirm={controller.confirmDelete}
            teammateName={controller.teammate.name}
            isDeleting={controller.isDeleting}
          />
        )}
      </PageShell.Content>
    </TeammatePageState>
  );
}
