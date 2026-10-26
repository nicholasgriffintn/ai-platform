import {
  DocumentMetadataPanel,
  isStudyOutputKind,
  isWorkOutputKind,
  ViewerStatus,
} from "@ngriffin_uk/polychat-component-content";
import { Button, EmptyState } from "@ngriffin_uk/polychat-component-ui";
import {
  OutputProvenanceSummary,
  OutputRevisionReview,
  ShareLinkList,
} from "@ngriffin_uk/polychat-component-workspaces";
import { isAuthenticationError } from "@ngriffin_uk/polychat-library-client";
import {
  useDescribeDocument,
  useOutput,
  useOutputHistory,
  useOutputShares,
  useRestoreOutputRevision,
  useRunnableTool,
} from "@ngriffin_uk/polychat-library-react";
import {
  DISCOVER_EPISODE_KIND,
  DISCOVER_SEASON_KIND,
  DOCUMENT_OUTPUT_KIND,
  deriveDocumentStatistics,
  discoverSeasonContentSchema,
  documentExportFilename,
  readDocumentBody,
  readDocumentMetadata,
  type Output,
} from "@ngriffin_uk/polychat-schemas";
import { downloadTextFile } from "@ngriffin_uk/polychat-utility-react";
import {
  Check,
  Download,
  History,
  Info,
  Library,
  Link2,
  MessageSquareText,
  Share2,
} from "lucide-react";
import { useState } from "react";

import { SignInEmptyState } from "../../Account/SignInEmptyState.js";
import { ResponseRenderer } from "../../Content/ResponseRenderer.js";
import { EpisodePlayer } from "../../Discover/Episode/EpisodePlayer.js";
import { SeasonView } from "../../Discover/Episode/SeasonView.js";
import { StudyOutputStage } from "../../Notebooks/StudyOutputStage.js";
import { DocumentOutputWorkbench } from "../DocumentOutputWorkbench.js";
import { FileDiscussion } from "../FileDiscussion.js";
import { outputToFileItem } from "../Library/file-items.js";
import { useFileActions } from "../Library/useFileActions.js";
import { OutputCouncilReviews } from "../OutputCouncilReviews.js";
import { useDocumentDiscussion } from "../useDocumentDiscussion.js";
import { useOutputSharing } from "../useOutputSharing.js";
import { WorkOutputWorkbench } from "../WorkOutputWorkbench.js";
import { EditToggleButton } from "./EditToggleButton.js";
import { FileNoPreview } from "./FileNoPreview.js";
import { FileSourcesList } from "./FileSourcesList.js";
import { FileViewerCloseButton } from "./FileViewerCloseButton.js";
import { type FileViewerChrome, FileViewerFrame } from "./FileViewerFrame.js";
import { GenerationStage, hasGenerationMedia } from "./GenerationStage.js";
import { MarkdownStage } from "./MarkdownStage.js";
import { useFileViewerPanels } from "./useFileViewerPanels.js";

function OutputStage({
  output,
  downloadUrl,
  isEditing,
}: {
  output: Output;
  downloadUrl?: string;
  isEditing: boolean;
}) {
  const { data: producingTool } = useRunnableTool(output.capabilityId ?? null);
  const markdownBody = readDocumentBody(output.content);

  if (markdownBody !== null && isEditing) {
    return <DocumentOutputWorkbench key={output.id} output={output} body={markdownBody} canEdit />;
  }

  if (markdownBody !== null) {
    return <MarkdownStage markdown={markdownBody} />;
  }

  if (output.kind === DISCOVER_EPISODE_KIND) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-8">
        <EpisodePlayer key={output.id} episodeId={output.id} />
      </div>
    );
  }

  const season =
    output.kind === DISCOVER_SEASON_KIND
      ? discoverSeasonContentSchema.safeParse(output.content)
      : null;

  if (season?.success) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-8">
        <SeasonView key={output.id} season={season.data} />
      </div>
    );
  }

  if (isWorkOutputKind(output.kind)) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-8">
        <WorkOutputWorkbench key={output.id} output={output} />
      </div>
    );
  }

  if (isStudyOutputKind(output.kind)) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-8">
        <StudyOutputStage key={output.id} output={output} />
      </div>
    );
  }

  if (hasGenerationMedia(output.content)) {
    return <GenerationStage title={output.title} content={output.content} />;
  }

  if (output.content && Object.keys(output.content).length > 0) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-8">
        <ResponseRenderer app={producingTool ?? undefined} result={output.content} />
      </div>
    );
  }

  return (
    <FileNoPreview
      name={output.file?.filename ?? output.title}
      detail={output.file?.mimeType ?? undefined}
      downloadUrl={downloadUrl}
    />
  );
}

function OutputInfo({ output }: { output: Output }) {
  const describeDocument = useDescribeDocument();
  const documentBody =
    output.kind === DOCUMENT_OUTPUT_KIND ? readDocumentBody(output.content) : null;

  return (
    <div className="flex flex-col gap-4">
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
        <dt className="text-muted-foreground">Made by</dt>
        <dd className="truncate text-foreground">{output.capabilityId}</dd>
        <dt className="text-muted-foreground">Revision</dt>
        <dd className="text-foreground tabular-nums">{output.revision}</dd>
      </dl>
      {output.provenance ? <OutputProvenanceSummary provenance={output.provenance} /> : null}
      {documentBody !== null ? (
        <DocumentMetadataPanel
          metadata={{
            ...readDocumentMetadata(output.content),
            ...deriveDocumentStatistics(documentBody),
          }}
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
    </div>
  );
}

function OutputComments({ output }: { output: Output }) {
  const discussion = useDocumentDiscussion({
    subject: { type: "output", id: output.id },
    revision: output.revision,
  });
  const body = readDocumentBody(output.content) ?? "";

  return (
    <FileDiscussion
      projectId={output.projectId}
      revision={output.revision}
      documentBody={body}
      selection={null}
      hasUnsavedChanges={false}
      discussion={discussion}
    />
  );
}

function OutputHistory({ output }: { output: Output }) {
  const restoreRevision = useRestoreOutputRevision();
  const { data: history, error } = useOutputHistory(output.id);

  if (!history) {
    return (
      <p role={error ? "alert" : undefined} className="text-sm text-muted-foreground">
        {error ? "Version history is unavailable." : "Loading version history…"}
      </p>
    );
  }

  return (
    <OutputRevisionReview
      history={history}
      isRestoring={restoreRevision.isPending}
      errorMessage={restoreRevision.error?.message}
      onRestore={async (revision, expectedRevision) => {
        await restoreRevision.mutateAsync({ outputId: output.id, revision, expectedRevision });
      }}
    />
  );
}

function OutputSharing({ output }: { output: Output }) {
  const sharing = useOutputSharing();
  const { data: shares } = useOutputShares(output.id);

  return (
    <div className="flex flex-col gap-3">
      <Button
        variant="secondary"
        size="sm"
        className="self-start"
        icon={<Link2 size={14} />}
        isLoading={sharing.create.isPending}
        onClick={() => void sharing.copy(output.id)}
      >
        {sharing.copiedOutputId === output.id ? "Link copied" : "Copy a new share link"}
      </Button>
      {sharing.error?.outputId === output.id ? (
        <p role="alert" className="text-sm text-failure">
          {sharing.error.message}
        </p>
      ) : null}
      {shares?.length ? (
        <ShareLinkList
          shares={shares}
          revokingShareId={
            sharing.revoke.isPending ? (sharing.revoke.variables?.shareId ?? null) : null
          }
          onRevoke={(shareId) => sharing.revokeLink(output.id, shareId)}
        />
      ) : (
        <p className="text-sm text-muted-foreground">No share links yet.</p>
      )}
    </div>
  );
}

export function OutputViewer({
  basePath,
  projectId,
  outputId,
  chrome,
  onDeleted,
}: {
  basePath: string;
  projectId?: string;
  outputId: string;
  chrome: FileViewerChrome;
  onDeleted: () => void;
}) {
  const panels = useFileViewerPanels();
  const [isEditing, setIsEditing] = useState(false);
  const actions = useFileActions({ projectId, onDeleted });
  const sharing = useOutputSharing();
  const { data: shares } = useOutputShares(outputId);
  const { data: output, isLoading, error } = useOutput(outputId);

  if (isLoading) {
    return (
      <ViewerStatus
        label="Loading file"
        actions={<FileViewerCloseButton onClose={chrome.onClose} />}
      />
    );
  }

  if (isAuthenticationError(error)) {
    return (
      <ViewerStatus
        label="Sign in to open this file"
        actions={<FileViewerCloseButton onClose={chrome.onClose} />}
      >
        <SignInEmptyState
          title="Sign in to open this file"
          message="Sign in to open this file."
          className="h-full"
        />
      </ViewerStatus>
    );
  }

  if (error || !output) {
    return (
      <ViewerStatus
        label="File unavailable"
        actions={<FileViewerCloseButton onClose={chrome.onClose} />}
      >
        <EmptyState
          variant="inset"
          title="File unavailable"
          message={error?.message ?? "File not found"}
          className="h-full"
        />
      </ViewerStatus>
    );
  }

  const item = outputToFileItem(output, basePath);
  const linkedSources = output.provenance?.sources ?? [];
  const documentBody = readDocumentBody(output.content);
  const isDocument = documentBody !== null && output.kind === DOCUMENT_OUTPUT_KIND;
  const hasCopiedLink = sharing.copiedOutputId === output.id;

  return (
    <FileViewerFrame
      item={item}
      subject={{ type: "output", id: output.id }}
      location="Files · Made"
      projectId={projectId}
      panels={panels}
      actions={actions}
      chrome={chrome}
      stage={<OutputStage output={output} downloadUrl={item.downloadUrl} isEditing={isEditing} />}
      headerActions={
        <>
          {isDocument ? (
            <EditToggleButton
              isEditing={isEditing}
              onToggle={() => setIsEditing((editing) => !editing)}
            />
          ) : null}
          {documentBody !== null || item.downloadUrl ? (
            <Button
              variant="icon"
              size="sm"
              icon={<Download size={15} />}
              aria-label="Download"
              title="Download"
              onClick={() =>
                documentBody !== null
                  ? downloadTextFile(
                      documentExportFilename(output.title),
                      documentBody,
                      "text/markdown",
                    )
                  : window.open(item.downloadUrl, "_blank", "noopener,noreferrer")
              }
            />
          ) : null}
          <Button
            variant="icon"
            size="sm"
            icon={hasCopiedLink ? <Check size={15} /> : <Share2 size={15} />}
            aria-label={hasCopiedLink ? "Link copied" : "Copy share link"}
            title={hasCopiedLink ? "Link copied" : "Copy share link"}
            disabled={sharing.create.isPending}
            onClick={() => void sharing.copy(output.id)}
          />
        </>
      }
      drawers={[
        {
          key: "info",
          quick: true,
          label: "File info",
          icon: <Info size={14} aria-hidden="true" />,
          content: <OutputInfo output={output} />,
        },
        ...(linkedSources.length > 0
          ? [
              {
                key: "sources" as const,
                label: "Sources",
                detail: String(linkedSources.length),
                icon: <Library size={14} aria-hidden="true" />,
                content: (
                  <FileSourcesList
                    sources={linkedSources}
                    projectId={projectId}
                    onOpen={(id) => chrome.onOpenFile({ origin: "source", id, projectId })}
                  />
                ),
              },
            ]
          : []),
        {
          key: "history",
          label: "Version history",
          detail: String(output.revision),
          icon: <History size={14} aria-hidden="true" />,
          content: <OutputHistory output={output} />,
        },
        ...(isDocument
          ? [
              {
                key: "comments" as const,
                label: "Comments",
                icon: <MessageSquareText size={14} aria-hidden="true" />,
                content: <OutputComments output={output} />,
              },
            ]
          : []),
        {
          key: "sharing",
          label: "Share links",
          detail: shares?.length ? String(shares.length) : undefined,
          icon: <Link2 size={14} aria-hidden="true" />,
          content: <OutputSharing output={output} />,
        },
      ]}
    />
  );
}
