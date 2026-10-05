import { DocumentMetadataPanel } from "@ngriffin_uk/polychat-component-content";
import { Card, CardGridLoadingSkeleton, EmptyState } from "@ngriffin_uk/polychat-component-ui";
import {
  OutputCardGrid,
  OutputDetailHeader,
  OutputRevisionReview,
  ShareLinkList,
} from "@ngriffin_uk/polychat-component-workspaces";
import { isAuthenticationError } from "@ngriffin_uk/polychat-library-client";
import {
  useOutput,
  useOutputHistory,
  useOutputs,
  useOutputShares,
  useDescribeDocument,
  useRestoreOutputRevision,
  useRunnableTool,
} from "@ngriffin_uk/polychat-library-react";
import {
  DOCUMENT_OUTPUT_KIND,
  readDocumentBody,
  readDocumentMetadata,
  deriveDocumentStatistics,
} from "@ngriffin_uk/polychat-schemas";
import { Puzzle } from "lucide-react";

import { SignInEmptyState } from "../Account/SignInEmptyState.js";
import { ResponseRenderer } from "../Content/ResponseRenderer.js";
import { DocumentOutputWorkbench } from "./DocumentOutputWorkbench.js";
import { useOutputSharing } from "./useOutputSharing.js";

export function OutputsLibrary({ basePath, projectId, subpath }: OutputsLibraryProps) {
  const sharing = useOutputSharing();
  const restoreRevision = useRestoreOutputRevision();
  const describeDocument = useDescribeDocument();
  const outputId = subpath.split("/").find(Boolean);
  const { data: shares } = useOutputShares(outputId ?? null);
  const {
    data: outputs,
    isLoading,
    error,
  } = useOutputs(projectId, undefined, {
    enabled: !outputId,
  });
  const {
    data: output,
    isLoading: isOutputLoading,
    error: outputError,
  } = useOutput(outputId ?? null);
  const { data: producingTool } = useRunnableTool(output?.capabilityId ?? null);
  const { data: outputHistory, error: outputHistoryError } = useOutputHistory(outputId ?? null);

  const documentBody =
    output && output.kind === DOCUMENT_OUTPUT_KIND ? readDocumentBody(output.content) : null;
  const documentMetadata = output ? readDocumentMetadata(output.content) : null;

  if (outputId) {
    if (isOutputLoading) {
      return <CardGridLoadingSkeleton count={1} label="Loading output" />;
    }

    if (isAuthenticationError(outputError)) {
      return (
        <SignInEmptyState
          title="Sign in to view this output"
          message="Sign in to open this output."
        />
      );
    }

    if (outputError || !output) {
      return (
        <EmptyState
          title="Output unavailable"
          message={outputError?.message ?? "Output not found"}
        />
      );
    }

    return (
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
        {documentBody === null ? (
          <ResponseRenderer app={producingTool ?? undefined} result={output.content} />
        ) : (
          <DocumentOutputWorkbench key={output.id} output={output} body={documentBody} />
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
    );
  }

  if (isLoading) {
    return <CardGridLoadingSkeleton count={4} label="Loading outputs" />;
  }

  if (isAuthenticationError(error)) {
    return (
      <SignInEmptyState
        title="Sign in to view saved outputs"
        message="Saved outputs are kept against your account."
      />
    );
  }

  if (error) {
    return <EmptyState title="Outputs unavailable" message={error.message} />;
  }

  if (!outputs?.length) {
    return (
      <EmptyState
        icon={<Puzzle size={24} className="text-muted-foreground" />}
        title="Nothing made yet"
        message="Ask a teammate or run an app and the result lands here."
      />
    );
  }

  return (
    <OutputCardGrid
      outputs={outputs.map((item) => ({
        id: item.id,
        title: item.title,
        capabilityId: item.capabilityId,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
        href: `${basePath}/${item.id}`,
      }))}
    />
  );
}

interface OutputsLibraryProps {
  basePath: string;
  projectId?: string;
  subpath: string;
}
