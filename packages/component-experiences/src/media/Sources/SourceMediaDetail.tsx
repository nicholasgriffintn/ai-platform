import { Button } from "@ngriffin_uk/polychat-component-ui";
import type { SourceMediaMetadata, SourceMediaType } from "@ngriffin_uk/polychat-schemas";
import { formatDuration } from "@ngriffin_uk/polychat-utility-core";
import { Captions, FileText } from "lucide-react";
import { useMemo } from "react";

import {
  formatTranscriptCaptions,
  transcriptCaptionCues,
  transcriptSpeakerNames,
  type CaptionFormat,
} from "./captions";
import { MediaNotes, type MediaNotesProps } from "./MediaNotes";
import { TranscriptViewer } from "./TranscriptViewer";
import { useCaptionTrack } from "./useCaptionTrack";

export interface SourceMediaDetailProps extends Pick<
  MediaNotesProps,
  "onAddActionItem" | "addedActionItems" | "addingActionItem"
> {
  title: string;
  createdAt: string;
  mediaType: SourceMediaType;
  mediaUrl: string;
  coverUrl?: string;
  media: SourceMediaMetadata;
  onDownloadTranscript?: () => void;
  onDownloadCaptions?: (format: CaptionFormat) => void;
}

function MediaPlayer({
  mediaType,
  mediaUrl,
  title,
  captionsVtt,
}: Pick<SourceMediaDetailProps, "mediaType" | "mediaUrl" | "title"> & {
  captionsVtt: string | null;
}) {
  const captionTrackRef = useCaptionTrack(captionsVtt);

  if (mediaType === "image") {
    return (
      <img
        src={mediaUrl}
        alt={title}
        className="mx-auto max-h-full w-auto max-w-full rounded-lg object-contain"
      />
    );
  }

  if (mediaType === "video") {
    return (
      <video controls className="w-full rounded-lg border border-border" src={mediaUrl}>
        <track ref={captionTrackRef} kind="captions" srcLang="en" label="Captions" default />
      </video>
    );
  }

  return (
    <audio controls className="w-full" src={mediaUrl}>
      <track ref={captionTrackRef} kind="captions" srcLang="en" label="Captions" default />
    </audio>
  );
}

export function SourceMediaDetail({
  title,
  createdAt,
  mediaType,
  mediaUrl,
  coverUrl,
  media,
  onDownloadTranscript,
  onDownloadCaptions,
  onAddActionItem,
  addedActionItems,
  addingActionItem,
}: SourceMediaDetailProps) {
  const transcript = media.transcript;
  const readyTranscript = transcript?.status === "ready" ? transcript : null;
  const captionsVtt = useMemo(
    () =>
      readyTranscript && transcriptCaptionCues(readyTranscript).length > 0
        ? formatTranscriptCaptions(readyTranscript, "vtt")
        : null,
    [readyTranscript],
  );
  const duration = formatDuration(media.durationSeconds);

  if (mediaType === "image" && !media.notes?.summary) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <MediaPlayer mediaType={mediaType} mediaUrl={mediaUrl} title={title} captionsVtt={null} />
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        {mediaType === "audio" ? (
          <div className="size-28 shrink-0 overflow-hidden rounded-xl bg-selection">
            {coverUrl ? (
              <img src={coverUrl} alt={title} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
                No cover yet
              </div>
            )}
          </div>
        ) : null}
        <div className="min-w-0 flex-1">
          <MediaPlayer
            mediaType={mediaType}
            mediaUrl={mediaUrl}
            title={title}
            captionsVtt={captionsVtt}
          />
        </div>
      </div>

      <div>
        <div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
          <span>{new Date(createdAt).toLocaleDateString()}</span>
          {duration ? (
            <>
              <span>•</span>
              <span>{duration}</span>
            </>
          ) : null}
        </div>

        {media.notes?.summary ? (
          <section className="border-t border-border pt-6 pb-2">
            <h2 className="mb-4 text-xl font-semibold text-foreground">Summary</h2>
            <p className="rounded-lg border border-border bg-surface p-5 whitespace-pre-line text-foreground">
              {media.notes.summary}
            </p>
          </section>
        ) : null}

        <MediaNotes
          decisions={media.notes?.decisions}
          actionItems={media.notes?.actionItems}
          onAddActionItem={onAddActionItem}
          addedActionItems={addedActionItems}
          addingActionItem={addingActionItem}
        />

        {transcript?.status === "processing" ? (
          <p className="pt-6 text-sm text-muted-foreground">
            Transcribing… this can take a minute.
          </p>
        ) : null}

        {transcript?.status === "failed" ? (
          <p role="alert" className="pt-6 text-sm text-failure">
            {transcript.error ?? "Transcription failed."}
          </p>
        ) : null}

        {readyTranscript ? (
          <section className="pt-6">
            <div className="mb-4 flex items-center justify-between gap-2">
              <h2 className="text-xl font-semibold text-foreground">Transcript</h2>
              <div className="ml-auto flex flex-wrap gap-2">
                {captionsVtt && onDownloadCaptions ? (
                  <>
                    <Button
                      onClick={() => onDownloadCaptions("srt")}
                      variant="secondary"
                      size="sm"
                      icon={<Captions size={16} />}
                    >
                      SRT
                    </Button>
                    <Button
                      onClick={() => onDownloadCaptions("vtt")}
                      variant="secondary"
                      size="sm"
                      icon={<Captions size={16} />}
                    >
                      VTT
                    </Button>
                  </>
                ) : null}
                {onDownloadTranscript ? (
                  <Button
                    onClick={onDownloadTranscript}
                    variant="secondary"
                    size="sm"
                    icon={<FileText size={16} />}
                  >
                    Download
                  </Button>
                ) : null}
              </div>
            </div>
            <div className="rounded-lg border border-border bg-surface p-5">
              <TranscriptViewer
                transcript={readyTranscript}
                speakerNames={transcriptSpeakerNames(readyTranscript)}
              />
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}
