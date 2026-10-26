import { ViewerStatus } from "@ngriffin_uk/polychat-component-content";
import {
  formatTranscriptCaptions,
  SourceMediaDetail,
  type CaptionFormat,
} from "@ngriffin_uk/polychat-component-experiences/media";
import {
  Button,
  ButtonLink,
  EmptyState,
  textLinkClassName,
} from "@ngriffin_uk/polychat-component-ui";
import { getSourceContentUrl, getSourceCoverUrl } from "@ngriffin_uk/polychat-library-client";
import {
  createSourceAttachment,
  getFilesPath,
  useSource,
  useSourceMediaActions,
} from "@ngriffin_uk/polychat-library-react";
import {
  formatTranscriptText,
  getSourceMediaType,
  isTranscribableMediaType,
  readSourceGeneration,
  readSourceMedia,
  type Source,
  type SourceKind,
} from "@ngriffin_uk/polychat-schemas";
import { formatRelativeTime, humaniseIdentifier } from "@ngriffin_uk/polychat-utility-core";
import { downloadTextFile } from "@ngriffin_uk/polychat-utility-react";
import {
  AudioLines,
  Brain,
  ExternalLink,
  FileText,
  FileWarning,
  ImagePlus,
  Info,
  Link2,
  Library,
} from "lucide-react";
import { useNavigate } from "react-router";

import { sourceToFileItem } from "../Library/file-items.js";
import { useFileActions } from "../Library/useFileActions.js";
import { useSourceActionItemTasks } from "../Sources/useSourceActionItemTasks.js";
import { FileNoPreview } from "./FileNoPreview.js";
import { FileSourcesList } from "./FileSourcesList.js";
import { FileViewerCloseButton } from "./FileViewerCloseButton.js";
import { type FileViewerChrome, FileViewerFrame } from "./FileViewerFrame.js";
import { MarkdownStage } from "./MarkdownStage.js";
import { SourceKnowledgePanel } from "./SourceKnowledgePanel.js";
import { SourceListen } from "./SourceListen.js";
import { useFileViewerPanels } from "./useFileViewerPanels.js";

const LISTENABLE_KINDS: ReadonlySet<SourceKind> = new Set(["text", "url", "file", "connector"]);

function sourceFilename(source: Source, suffix: string): string {
  return `${source.title.replace(/\s+/g, "-")}-${suffix}`;
}

function MediaActions({ source }: { source: Source }) {
  const actions = useSourceMediaActions(source.id);
  const media = readSourceMedia(source.metadata);
  const transcriptStatus = media.transcript?.status;
  const canTranscribe =
    source.kind !== "podcast" &&
    isTranscribableMediaType(getSourceMediaType(source.file?.mimeType));
  const error = actions.transcribe.error ?? actions.writeNotes.error ?? actions.createCover.error;

  return (
    <>
      {canTranscribe && transcriptStatus !== "ready" ? (
        <Button
          variant="ghost"
          size="sm"
          icon={<AudioLines size={16} />}
          isLoading={actions.transcribe.isPending || transcriptStatus === "processing"}
          onClick={() => actions.transcribe.mutate()}
        >
          {transcriptStatus === "failed" ? "Try transcribing again" : "Transcribe"}
        </Button>
      ) : null}
      {transcriptStatus === "ready" && source.kind !== "podcast" ? (
        <Button
          variant="ghost"
          size="sm"
          icon={<FileText size={16} />}
          isLoading={actions.writeNotes.isPending}
          onClick={() => actions.writeNotes.mutate(undefined)}
        >
          {media.notes ? "Rewrite notes" : "Write notes"}
        </Button>
      ) : null}
      {getSourceMediaType(source.file?.mimeType) !== "image" ? (
        <Button
          variant="ghost"
          size="sm"
          icon={<ImagePlus size={16} />}
          isLoading={actions.createCover.isPending}
          onClick={() => actions.createCover.mutate(undefined)}
        >
          {media.cover ? "New cover" : "Make cover"}
        </Button>
      ) : null}
      {error ? (
        <span role="alert" className="px-2 text-sm text-failure">
          {error.message}
        </span>
      ) : null}
    </>
  );
}

function MediaSource({ source }: { source: Source }) {
  const media = readSourceMedia(source.metadata);
  const mediaType = getSourceMediaType(source.file?.mimeType);
  const tasks = useSourceActionItemTasks(source.projectId, source.title);
  const transcript = media.transcript?.status === "ready" ? media.transcript : null;

  if (!mediaType) {
    return null;
  }

  return (
    <>
      {tasks.error ? (
        <p role="alert" className="text-sm text-failure">
          {tasks.error}
        </p>
      ) : null}
      <SourceMediaDetail
        title={source.title}
        createdAt={source.createdAt}
        mediaType={mediaType}
        mediaUrl={getSourceContentUrl(source.id)}
        coverUrl={media.cover ? getSourceCoverUrl(source.id) : undefined}
        media={media}
        onDownloadTranscript={
          transcript
            ? () =>
                downloadTextFile(
                  sourceFilename(source, "transcript.txt"),
                  formatTranscriptText(transcript),
                )
            : undefined
        }
        onDownloadCaptions={
          transcript
            ? (format: CaptionFormat) =>
                downloadTextFile(
                  sourceFilename(source, `captions.${format}`),
                  formatTranscriptCaptions(transcript, format),
                  format === "vtt" ? "text/vtt" : "application/x-subrip",
                )
            : undefined
        }
        onAddActionItem={
          tasks.canAdd ? (item, index) => void tasks.addActionItem(item, index) : undefined
        }
        addedActionItems={tasks.added}
        addingActionItem={tasks.adding}
      />
    </>
  );
}

function SourceStage({ source, downloadUrl }: { source: Source; downloadUrl?: string }) {
  const generation = readSourceGeneration(source.metadata);
  const mediaType = getSourceMediaType(source.file?.mimeType);

  if (source.status === "failed") {
    return (
      <EmptyState
        variant="inset"
        icon={<FileWarning size={24} className="text-failure" />}
        title="Polychat couldn't read this file"
        message={generation?.error ?? "Upload it again, or ask Polychat what went wrong."}
        className="h-full"
      />
    );
  }

  if (source.status === "processing" && !source.content) {
    return (
      <EmptyState
        variant="inset"
        title={source.kind === "podcast" ? "Recording the episode" : "Reading the file"}
        message={
          source.kind === "podcast"
            ? "Writing and voicing the episode. This takes a few minutes."
            : "This updates when it is ready."
        }
        className="h-full"
      />
    );
  }

  if (mediaType) {
    return <MediaSource source={source} />;
  }

  if (source.file?.mimeType === "application/pdf" && downloadUrl) {
    return (
      <object
        data={downloadUrl}
        type="application/pdf"
        aria-label={source.title}
        className="h-full w-full bg-surface"
      >
        <FileNoPreview
          name={source.file.filename ?? source.title}
          detail={source.file.mimeType}
          downloadUrl={downloadUrl}
        />
      </object>
    );
  }

  if (source.content) {
    return (
      <MarkdownStage
        markdown={source.content}
        header={
          <div className="flex flex-col gap-3">
            {source.externalUri ? (
              <a
                href={source.externalUri}
                target="_blank"
                rel="noopener noreferrer"
                className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
              >
                <ExternalLink size={14} className="shrink-0" aria-hidden="true" />
                <span className="truncate">{source.externalUri}</span>
              </a>
            ) : null}
            {LISTENABLE_KINDS.has(source.kind) ? <SourceListen source={source} /> : null}
          </div>
        }
      />
    );
  }

  if (source.externalUri) {
    return (
      <EmptyState
        variant="inset"
        icon={<Link2 size={24} className="text-muted-foreground" />}
        title={source.title}
        message={source.externalUri}
        action={
          <ButtonLink
            href={source.externalUri}
            target="_blank"
            rel="noopener noreferrer"
            variant="outline"
            size="sm"
            icon={<ExternalLink size={14} />}
          >
            Open original
          </ButtonLink>
        }
        className="h-full [overflow-wrap:anywhere]"
      />
    );
  }

  return (
    <FileNoPreview
      name={source.file?.filename ?? source.title}
      detail={source.file?.mimeType}
      downloadUrl={downloadUrl}
    />
  );
}

function SourceInfo({ source, detail }: { source: Source; detail: string }) {
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
      <dt className="text-muted-foreground">Type</dt>
      <dd className="text-foreground">{detail}</dd>
      <dt className="text-muted-foreground">Added</dt>
      <dd className="text-foreground">{formatRelativeTime(source.createdAt)}</dd>
      {source.file?.filename ? (
        <>
          <dt className="text-muted-foreground">File</dt>
          <dd className="truncate text-foreground">{source.file.filename}</dd>
        </>
      ) : null}
      {source.externalUri ? (
        <>
          <dt className="text-muted-foreground">Original</dt>
          <dd className="truncate">
            <a
              href={source.externalUri}
              target="_blank"
              rel="noopener noreferrer"
              className={textLinkClassName({})}
            >
              {source.externalUri}
            </a>
          </dd>
        </>
      ) : null}
      {source.status !== "available" ? (
        <>
          <dt className="text-muted-foreground">Status</dt>
          <dd className="text-foreground">{humaniseIdentifier(source.status)}</dd>
        </>
      ) : null}
    </dl>
  );
}

export function SourceViewer({
  basePath,
  projectId,
  sourceId,
  chrome,
  onDeleted,
}: {
  basePath: string;
  projectId?: string;
  sourceId: string;
  chrome: FileViewerChrome;
  onDeleted: () => void;
}) {
  const panels = useFileViewerPanels();
  const navigate = useNavigate();
  const actions = useFileActions({ projectId, onDeleted });
  const { data: source, isLoading, error } = useSource(sourceId);

  if (isLoading) {
    return (
      <ViewerStatus
        label="Loading file"
        actions={<FileViewerCloseButton onClose={chrome.onClose} />}
      />
    );
  }

  if (error || !source) {
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

  const item = sourceToFileItem(source, basePath);
  const linkedSources = (readSourceGeneration(source.metadata)?.sourceIds ?? [])
    .filter((id) => id !== source.id)
    .map((id) => ({ id, name: null }));
  const sourceAttachment = createSourceAttachment(source, getSourceContentUrl(source.id));

  return (
    <FileViewerFrame
      item={item}
      subject={{ type: "source", id: source.id }}
      location="Files · Sources"
      projectId={projectId}
      panels={panels}
      actions={actions}
      chrome={chrome}
      stage={<SourceStage source={source} downloadUrl={item.downloadUrl} />}
      toolbar={
        getSourceMediaType(source.file?.mimeType) && source.status !== "failed" ? (
          <MediaActions source={source} />
        ) : undefined
      }
      askAttachment={
        sourceAttachment && sourceAttachment.type !== "markdown_document"
          ? sourceAttachment
          : undefined
      }
      drawers={[
        {
          key: "info",
          label: "File info",
          icon: <Info size={14} aria-hidden="true" />,
          content: <SourceInfo source={source} detail={item.detail} />,
        },
        ...(source.kind === "memory"
          ? []
          : [
              {
                key: "knowledge" as const,
                label: "Knowledge",
                icon: <Brain size={14} aria-hidden="true" />,
                content: (
                  <SourceKnowledgePanel
                    sourceId={source.id}
                    onOpenSource={(id) => chrome.onOpenFile({ origin: "source", id, projectId })}
                    onOpenCollection={(id) => void navigate(getFilesPath(basePath, "folders", id))}
                  />
                ),
              },
            ]),
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
      ]}
    />
  );
}
