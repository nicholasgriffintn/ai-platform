import { DocumentMetadataPanel, isWorkOutputKind } from "@ngriffin_uk/polychat-component-content";
import { Card, CardGridLoadingSkeleton, EmptyState } from "@ngriffin_uk/polychat-component-ui";
import {
  OutputDetailHeader,
  OutputRevisionReview,
  ShareLinkList,
} from "@ngriffin_uk/polychat-component-workspaces";
import { isAuthenticationError } from "@ngriffin_uk/polychat-library-client";
import {
  getFilesPath,
  useDescribeDocument,
  useOutput,
  useOutputHistory,
  useOutputShares,
  useRestoreOutputRevision,
  useRunnableTool,
  useSourceCollections,
} from "@ngriffin_uk/polychat-library-react";
import {
  DOCUMENT_OUTPUT_KIND,
  deriveDocumentStatistics,
  readDocumentBody,
  readDocumentMetadata,
} from "@ngriffin_uk/polychat-schemas";
import { useNavigate } from "react-router";

import { SignInEmptyState } from "../Account/SignInEmptyState.js";
import { ResponseRenderer } from "../Content/ResponseRenderer.js";
import { DocumentOutputWorkbench } from "./DocumentOutputWorkbench.js";
import { FilesBreadcrumb } from "./FilesBreadcrumb.js";
import { outputToFileItem } from "./Library/file-items.js";
import { FileActionDialogs } from "./Library/FileActionDialogs.js";
import { FileItemMenu } from "./Library/FileItemMenu.js";
import { useFileActions } from "./Library/useFileActions.js";
import { OutputCouncilReviews } from "./OutputCouncilReviews.js";
import { useOutputSharing } from "./useOutputSharing.js";
import { WorkOutputWorkbench } from "./WorkOutputWorkbench.js";

export function OutputDetail({
  basePath,
  projectId,
  outputId,
}: {
  basePath: string;
  projectId?: string;
  outputId: string;
}) {
  const navigate = useNavigate();
  const madePath = getFilesPath(basePath, "made");
  const sharing = useOutputSharing();
  const actions = useFileActions({ projectId, onDeleted: () => void navigate(madePath) });
  const restoreRevision = useRestoreOutputRevision();
  const describeDocument = useDescribeDocument();
  const { data: folders } = useSourceCollections(projectId);
  const { data: shares } = useOutputShares(outputId);
  const { data: output, isLoading, error } = useOutput(outputId);
  const { data: producingTool } = useRunnableTool(output?.capabilityId ?? null);
  const { data: outputHistory, error: outputHistoryError } = useOutputHistory(outputId);
  const trail = [{ label: "Made", href: madePath }];

  if (isLoading) {
    return <CardGridLoadingSkeleton count={1} label="Loading output" />;
  }

  if (isAuthenticationError(error)) {
    return (
      <SignInEmptyState
        title="Sign in to view this output"
        message="Sign in to open this output."
      />
    );
  }

  if (error || !output) {
    return (
      <div className="space-y-4">
        <FilesBreadcrumb basePath={basePath} trail={trail} />
        <EmptyState title="Output unavailable" message={error?.message ?? "Output not found"} />
      </div>
    );
  }

  const documentBody =
    output.kind === DOCUMENT_OUTPUT_KIND ? readDocumentBody(output.content) : null;
  const documentMetadata = readDocumentMetadata(output.content);

  return (
    <div className="space-y-4">
      <FilesBreadcrumb
        basePath={basePath}
        trail={[...trail, { label: output.title }]}
        actions={
          <FileItemMenu
            item={outputToFileItem(output, basePath)}
            actions={actions}
            folders={folders ?? []}
          />
        }
      />
      <Card className="gap-5 p-6 shadow-none">
        <OutputDetailHeader
          capabilityId={output.capabilityId}
          title={output.title}
          provenance={output.provenance}
          isSharing={sharing.create.isPending}
          hasCopiedLink={sharing.copiedOutputId === output.id}
          errorMessage={sharing.error?.outputId === output.id ? sharing.error.message : undefined}
          onShare={() => void sharing.copy(output.id)}
        />
        {documentBody !== null ? (
          <DocumentOutputWorkbench key={output.id} output={output} body={documentBody} />
        ) : isWorkOutputKind(output.kind) ? (
          <WorkOutputWorkbench key={output.id} output={output} />
        ) : (
          <ResponseRenderer app={producingTool ?? undefined} result={output.content} />
        )}
        {documentBody !== null ? (
          <DocumentMetadataPanel
            metadata={{ ...documentMetadata, ...deriveDocumentStatistics(documentBody) }}
            canRegenerate
            isRegeneratingMetadata={describeDocument.isPending}
            onRegenerateMetadata={() =>
              describeDocument.mutate({ outputId: output.id, expectedRevision: output.revision })
            }
          />
        ) : null}
        {describeDocument.error ? (
          <p role="alert" className="text-sm text-failure">
            {describeDocument.error.message}
          </p>
        ) : null}
        <OutputCouncilReviews output={output} />
        {outputHistory ? (
          <OutputRevisionReview
            history={outputHistory}
            isRestoring={restoreRevision.isPending}
            errorMessage={
              restoreRevision.error?.message ??
              (outputHistoryError ? "Revision history is unavailable." : undefined)
            }
            onRestore={async (revision, expectedRevision) => {
              await restoreRevision.mutateAsync({
                outputId: output.id,
                revision,
                expectedRevision,
              });
            }}
          />
        ) : outputHistoryError ? (
          <p role="alert" className="text-sm text-failure">
            Revision history is unavailable.
          </p>
        ) : null}
        <ShareLinkList
          shares={shares ?? []}
          revokingShareId={
            sharing.revoke.isPending ? (sharing.revoke.variables?.shareId ?? null) : null
          }
          onRevoke={(shareId) => sharing.revokeLink(output.id, shareId)}
        />
      </Card>
      <FileActionDialogs actions={actions} />
    </div>
  );
}
