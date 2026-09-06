import { TeammateEditor, ConfirmDeleteModal } from "@ngriffin_uk/polychat-component-account";
import { BackLink, Card, FormLoadingSkeleton } from "@ngriffin_uk/polychat-component-ui";

import { SignInEmptyState } from "~/components/Core/SignInEmptyState";
import { isAuthenticationError } from "~/lib/errors";

import { NEW_TEAMMATE_ID, useTeammateEditorController } from "./useTeammateEditorController";

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
        title="Sign in to configure agents"
        message="Sign in to build agents and share them with a workspace."
        className="mx-4 my-8 min-h-[300px]"
      />
    );
  }

  if (controller.loadError || (teammateId !== NEW_TEAMMATE_ID && !controller.agent)) {
    return (
      <div className="mx-auto max-w-xl px-6 py-16">
        <Card className="p-8 text-center shadow-none">
          <h1 className="text-2xl font-bold text-foreground">Agent unavailable</h1>
          <p className="text-sm leading-6 text-muted-foreground">
            This agent no longer exists, or it is not yours to open.
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
          {controller.agent ? controller.agent.name : "New teammate"}
        </h1>
      </header>

      <TeammateEditor
        agent={controller.agent}
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

      {controller.agent && (
        <ConfirmDeleteModal
          isOpen={controller.deleteRequested}
          onClose={controller.cancelDelete}
          onConfirm={controller.confirmDelete}
          teammateName={controller.agent.name}
          isDeleting={controller.isDeleting}
        />
      )}
    </div>
  );
}
