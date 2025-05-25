import { FileText } from "lucide-react";
import { useCallback } from "react";

import { TranscriptViewer } from "~/components/Apps/Podcasts";
import { Button } from "~/components/ui";
import { Markdown } from "~/components/ui/Markdown";
import type { Podcast } from "~/types/podcast";

export function PodcastView({ podcast }: { podcast: Podcast }) {
  const handleDownloadTranscript = useCallback(() => {
    if (!podcast?.transcript) return;

    const transcriptText =
      typeof podcast.transcript === "string"
        ? podcast.transcript
        : podcast.transcript.segments
            .map((seg) => `[${seg.speaker}] ${seg.text}`)
            .join("\n\n");

    const blob = new Blob([transcriptText], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${podcast.title.replace(/\s+/g, "-")}-transcript.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [podcast]);

  const formatDuration = (seconds?: number) => {
    if (!seconds) return "Unknown duration";
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col lg:flex-row gap-8">
        <div className="w-full lg:w-1/3 lg:sticky lg:top-4 lg:self-start lg:max-h-screen lg:overflow-y-auto">
          <div className="bg-zinc-100 dark:bg-zinc-800 rounded-lg overflow-hidden aspect-square">
            {podcast.imageUrl ? (
              <img
                src={podcast.imageUrl}
                alt={podcast.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center">
                <span className="text-zinc-500 dark:text-zinc-400">
                  No image
                </span>
              </div>
            )}
          </div>
          <div className="mt-6">
            <h3 className="text-lg font-semibold mb-3 text-zinc-800 dark:text-zinc-200">
              Listen
            </h3>
            {/* biome-ignore lint/a11y/useMediaCaption: This is uploaded by the user */}
            <audio controls className="w-full" src={podcast.audioUrl}>
              Your browser does not support the audio element.
            </audio>
          </div>
        </div>

        <div className="w-full lg:w-2/3">
          <div className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400 mb-4">
            <span>{new Date(podcast.createdAt).toLocaleDateString()}</span>
            <span>•</span>
            <span>{formatDuration(podcast.duration)}</span>
          </div>

          {podcast.summary && (
            <div className="border-t border-zinc-200 dark:border-zinc-700 pt-6 pb-2">
              <h2 className="text-xl font-semibold mb-4 text-zinc-800 dark:text-zinc-200">
                Summary
              </h2>
              <div className="bg-off-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg p-5">
                <p className="text-zinc-700 dark:text-zinc-300 whitespace-pre-line">
                  {podcast.summary}
                </p>
              </div>
            </div>
          )}

          {podcast.description && podcast.description !== podcast.summary && (
            <div className="pt-6 pb-2">
              <h2 className="text-xl font-semibold mb-4 text-zinc-800 dark:text-zinc-200">
                Description
              </h2>
              <Markdown className="text-zinc-700 dark:text-zinc-300 mb-6">
                {podcast.description}
              </Markdown>
            </div>
          )}

          {podcast.transcript && (
            <div className="pt-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-zinc-800 dark:text-zinc-200">
                  Transcript
                </h2>
                <Button
                  onClick={handleDownloadTranscript}
                  variant="secondary"
                  size="sm"
                  className="ml-auto"
                  icon={<FileText size={16} />}
                >
                  Download
                </Button>
              </div>
              <div className="bg-off-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg p-5 max-h-[500px] overflow-y-auto">
                {typeof podcast.transcript === "string" ? (
                  <p className="text-zinc-700 dark:text-zinc-300 whitespace-pre-line">
                    {podcast.transcript}
                  </p>
                ) : (
                  <TranscriptViewer
                    transcript={podcast.transcript}
                    speakerNames={podcast.transcript.segments.reduce(
                      (acc, segment) => {
                        const speakerId = segment.speaker;
                        if (!acc[speakerId]) {
                          const speakerNum = speakerId.replace("SPEAKER_", "");
                          acc[speakerId] =
                            `Speaker ${Number.parseInt(speakerNum) + 1}`;
                        }
                        return acc;
                      },
                      {} as Record<string, string>,
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
