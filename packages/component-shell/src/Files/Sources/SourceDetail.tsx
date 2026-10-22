import {
  formatTranscriptCaptions,
  SourceMediaDetail,
  type CaptionFormat,
} from "@ngriffin_uk/polychat-component-experiences/media";
import {
  BackLink,
  Button,
  Card,
  CardGridLoadingSkeleton,
  EmptyState,
  textLinkClassName,
} from "@ngriffin_uk/polychat-component-ui";
import { getSourceContentUrl, getSourceCoverUrl } from "@ngriffin_uk/polychat-library-client";
import { useSource, useSourceMediaActions } from "@ngriffin_uk/polychat-library-react";
import {
  formatTranscriptText,
  getSourceMediaType,
  isTranscribableMediaType,
  readSourceGeneration,
  readSourceMedia,
  type Source,
} from "@ngriffin_uk/polychat-schemas";
import { downloadTextFile } from "@ngriffin_uk/polychat-utility-react";
import { AudioLines, FileText, ImagePlus } from "lucide-react";

import { useSourceActionItemTasks } from "./useSourceActionItemTasks.js";

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
          variant="secondary"
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
          variant="secondary"
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
          variant="secondary"
          size="sm"
          icon={<ImagePlus size={16} />}
          isLoading={actions.createCover.isPending}
          onClick={() => actions.createCover.mutate(undefined)}
        >
          {media.cover ? "New cover" : "Make cover"}
        </Button>
      ) : null}
      {error ? (
        <p role="alert" className="w-full text-sm text-failure">
          {error.message}
        </p>
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
        actions={<MediaActions source={source} />}
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

export function SourceDetail({ sourceId, backHref }: { sourceId: string; backHref: string }) {
  const { data: source, isLoading, error } = useSource(sourceId);

  if (isLoading) {
    return <CardGridLoadingSkeleton count={1} label="Loading source" />;
  }

  if (error || !source) {
    return <EmptyState title="Source unavailable" message={error?.message ?? "Source not found"} />;
  }

  const generation = readSourceGeneration(source.metadata);
  const isMedia = Boolean(getSourceMediaType(source.file?.mimeType));

  return (
    <div className="space-y-5">
      <BackLink href={backHref} label="Sources" />
      <div>
        <h2 className="text-2xl font-semibold text-foreground">{source.title}</h2>
        <p className="text-sm text-muted-foreground capitalize">
          {source.kind}
          {generation?.modelName ? ` · ${generation.modelName}` : ""}
          {source.status === "processing" ? " · Processing" : ""}
        </p>
      </div>
      {source.status === "processing" && !isMedia ? (
        <Card className="p-5 text-sm text-muted-foreground shadow-none">
          {source.kind === "podcast"
            ? "Writing and voicing the episode. This takes a few minutes."
            : "Generating. This page updates when it is ready."}
        </Card>
      ) : null}
      {source.status === "failed" && generation?.error ? (
        <p role="alert" className="text-sm text-failure">
          {generation.error}
        </p>
      ) : null}
      {isMedia ? <MediaSource source={source} /> : null}
      {!isMedia && source.content ? (
        <Card className="p-5 shadow-none">
          <p className="text-sm whitespace-pre-wrap text-foreground">{source.content}</p>
        </Card>
      ) : null}
      {source.file && !isMedia ? (
        <a href={getSourceContentUrl(source.id)} className={textLinkClassName({})}>
          Open file
        </a>
      ) : null}
    </div>
  );
}
