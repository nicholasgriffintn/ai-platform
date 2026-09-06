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
      <div className="flex flex-col lg:flex-row gap-8">
        <div className="w-full lg:w-1/3 lg:sticky lg:top-4 lg:self-start lg:max-h-screen lg:overflow-y-auto">
          <div className="bg-selection aspect-square overflow-hidden rounded-lg">
            {recording.imageUrl ? (
              <img
                src={recording.imageUrl}
                alt={recording.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="bg-selection flex h-full w-full items-center justify-center">
                <span className="text-muted-foreground">No image</span>
              </div>
            )}
          </div>
          <div className="mt-6">
            <h3 className="text-lg font-semibold mb-3 text-foreground">Listen</h3>
            <audio controls className="w-full" src={recording.audioUrl}>
              Your browser does not support the audio element.
            </audio>
          </div>
        </div>

        <div className="w-full lg:w-2/3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
            <span>{new Date(recording.createdAt).toLocaleDateString()}</span>
            <span>•</span>
            <span>{formatDuration(recording.duration)}</span>
          </div>

          {recording.summary && (
            <div className="border-t border-border pt-6 pb-2">
              <h2 className="text-xl font-semibold mb-4 text-foreground">Summary</h2>
              <div className="border-border bg-surface rounded-lg border p-5">
                <p className="text-foreground whitespace-pre-line">{recording.summary}</p>
              </div>
            </div>
          )}

          {recording.description && recording.description !== recording.summary && (
            <div className="pt-6 pb-2">
              <h2 className="text-xl font-semibold mb-4 text-foreground">Description</h2>
              <Markdown className="text-foreground mb-6">{recording.description}</Markdown>
            </div>
          )}

          {recording.transcript && (
            <div className="pt-6">
              <div className="flex items-center justify-between mb-4">
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
              <div className="border-border bg-surface max-h-[500px] overflow-y-auto rounded-lg border p-5">
                {typeof recording.transcript === "string" ? (
                  <p className="text-foreground whitespace-pre-line">{recording.transcript}</p>
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
