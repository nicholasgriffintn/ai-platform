import { Markdown } from "@ngriffin_uk/polychat-component-content";
import { Button } from "@ngriffin_uk/polychat-component-ui";
import type { Recording } from "@ngriffin_uk/polychat-schemas";
import { FileText } from "lucide-react";

import { TranscriptViewer } from "./TranscriptViewer";

export interface RecordingDetailViewProps {
  recording: Recording;
  onDownloadTranscript?: () => void;
}

export function RecordingDetailView({ recording, onDownloadTranscript }: RecordingDetailViewProps) {
  const formatDuration = (seconds?: number) => {
    if (!seconds) {
      return "Unknown duration";
    }

    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;

    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-8 lg:flex-row">
        <div className="w-full lg:sticky lg:top-4 lg:max-h-screen lg:w-1/3 lg:self-start lg:overflow-y-auto">
          <div className="aspect-square overflow-hidden rounded-lg bg-selection">
            {recording.imageUrl ? (
              <img
                src={recording.imageUrl}
                alt={recording.title}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-selection">
                <span className="text-muted-foreground">No image</span>
              </div>
            )}
          </div>
          <div className="mt-6">
            <h3 className="mb-3 text-lg font-semibold text-foreground">Listen</h3>
            <audio controls className="w-full" src={recording.audioUrl}>
              Your browser does not support the audio element.
            </audio>
          </div>
        </div>

        <div className="w-full lg:w-2/3">
          <div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
            <span>{new Date(recording.createdAt).toLocaleDateString()}</span>
            <span>•</span>
            <span>{formatDuration(recording.duration)}</span>
          </div>

          {recording.summary && (
            <div className="border-t border-border pt-6 pb-2">
              <h2 className="mb-4 text-xl font-semibold text-foreground">Summary</h2>
              <div className="rounded-lg border border-border bg-surface p-5">
                <p className="whitespace-pre-line text-foreground">{recording.summary}</p>
              </div>
            </div>
          )}

          {recording.description && recording.description !== recording.summary && (
            <div className="pt-6 pb-2">
              <h2 className="mb-4 text-xl font-semibold text-foreground">Description</h2>
              <Markdown className="mb-6 text-foreground">{recording.description}</Markdown>
            </div>
          )}

          {recording.transcript && (
            <div className="pt-6">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-xl font-semibold text-foreground">Transcript</h2>
                <Button
                  onClick={onDownloadTranscript}
                  variant="secondary"
                  size="sm"
                  className="ml-auto"
                  icon={<FileText size={16} />}
                >
                  Download
                </Button>
              </div>
              <div className="max-h-[500px] overflow-y-auto rounded-lg border border-border bg-surface p-5">
                {typeof recording.transcript === "string" ? (
                  <p className="whitespace-pre-line text-foreground">{recording.transcript}</p>
                ) : (
                  <TranscriptViewer
                    transcript={recording.transcript}
                    speakerNames={recording.transcript.segments.reduce<Record<string, string>>(
                      (acc, segment, index) => {
                        const speakerId = segment.speaker ?? `Segment ${index + 1}`;

                        if (!acc[speakerId]) {
                          const speakerNum = speakerId.startsWith("SPEAKER_")
                            ? Number.parseInt(speakerId.replace("SPEAKER_", ""))
                            : index;

                          acc[speakerId] = `Speaker ${speakerNum + 1}`;
                        }

                        return acc;
                      },
                      {},
                    )}
                  />
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
