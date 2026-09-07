import { TeammateEditor, ConfirmDeleteModal } from "@ngriffin_uk/polychat-component-account";
import { BackLink, Card, FormLoadingSkeleton } from "@ngriffin_uk/polychat-component-ui";
import { isAuthenticationError, NEW_TEAMMATE_ID } from "@ngriffin_uk/polychat-library-react";

import { SignInEmptyState } from "../Account/SignInEmptyState.js";
import { useTeammateEditorController } from "./useTeammateEditorController.js";

export interface TeammateEditorPageProps {
  teammateId: string;
  teammatesPath: string;
  backPath: string;
  backLabel: string;
  projectId?: string;
}

export function TeammateEditorPage({
  teammateId,
  teammatesPath,
  backPath,
  backLabel,
  projectId,
}: TeammateEditorPageProps) {
  const controller = useTeammateEditorController({
    teammateId,
    teammatesPath,
    backPath,
    projectId,
  });

  if (controller.isLoading) {
    return <FormLoadingSkeleton />;
  }

  if (isAuthenticationError(controller.loadError)) {
    return (
      <SignInEmptyState
        title="Sign in to configure teammates"
        message="Sign in to build teammates and share them with a workspace."
        className="mx-4 my-8 min-h-[300px]"
      />
    );
  }

  if (controller.loadError || (teammateId !== NEW_TEAMMATE_ID && !controller.teammate)) {
    return (
      <div className="mx-auto max-w-xl px-6 py-16">
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
    <div className="mx-auto max-w-4xl px-6 py-10 md:px-10 md:py-14">
      <header className="mb-8 space-y-3">
        <BackLink href={backPath} label={backLabel} />
        <h1 className="text-2xl font-bold text-foreground">
          {controller.teammate ? controller.teammate.name : "New teammate"}
        </h1>
      </header>

      <TeammateEditor
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
    </div>
  );
}
