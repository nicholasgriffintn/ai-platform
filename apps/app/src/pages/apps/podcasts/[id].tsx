import { CheckCircle, Clock, FileText } from "lucide-react";
import { type JSX, useCallback } from "react";
import { Link, useParams } from "react-router";

import { TranscriptViewer } from "~/components/Apps/Podcasts";
import { BackLink } from "~/components/BackLink";
import { PageHeader } from "~/components/PageHeader";
import { PageShell } from "~/components/PageShell";
import { PageTitle } from "~/components/PageTitle";
import { StandardSidebarContent } from "~/components/StandardSidebarContent";
import { Button } from "~/components/ui";
import { Markdown } from "~/components/ui/Markdown";
import { useFetchPodcast } from "~/hooks/usePodcasts";
import { cn } from "~/lib/utils";

export function meta() {
  return [
    { title: "Podcast Details - Polychat" },
    { name: "description", content: "View podcast details" },
  ];
}

export default function PodcastDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: podcast, isLoading, error } = useFetchPodcast(id || "");

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

  const renderStatusIndicator = (status: string) => {
    const statusMap: Record<
      string,
      { icon: JSX.Element; text: string; className: string }
    > = {
      complete: {
        icon: <CheckCircle size={16} />,
        text: "Complete",
        className:
          "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300",
      },
      processing: {
        icon: <Clock size={16} />,
        text: "Processing",
        className:
          "bg-amber-100 text-amber-800 dark:bg-amber-900/20 dark:text-amber-300",
      },
      transcribing: {
        icon: <Clock size={16} />,
        text: "Transcribing",
        className:
          "bg-amber-100 text-amber-800 dark:bg-amber-900/20 dark:text-amber-300",
      },
      summarizing: {
        icon: <Clock size={16} />,
        text: "Summarizing",
        className:
          "bg-amber-100 text-amber-800 dark:bg-amber-900/20 dark:text-amber-300",
      },
    };

    const statusInfo = statusMap[status] || statusMap.processing;

    return (
      <div
        className={cn(
          "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm",
          statusInfo.className,
        )}
      >
        {statusInfo.icon}
        <span>{statusInfo.text}</span>
      </div>
    );
  };

  return (
    <PageShell
      sidebarContent={<StandardSidebarContent />}
      className="max-w-7xl mx-auto"
      headerContent={<BackLink to="/apps/podcasts" label="Back to Podcasts" />}
      isBeta={true}
    >
      {isLoading ? (
        <div className="flex justify-center items-center min-h-[400px]">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 dark:border-blue-400" />
        </div>
      ) : error ? (
        <div className="p-4 bg-amber-100 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300 rounded-md border border-amber-200 dark:border-amber-800">
          <h3 className="font-semibold mb-2">Failed to load podcast</h3>
          <p>
            {error instanceof Error ? error.message : "Unknown error occurred"}
          </p>
          <Button
            type="button"
            variant="primary"
            onClick={() => window.location.reload()}
            className="mt-4"
          >
            Try Again
          </Button>
        </div>
      ) : podcast ? (
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
              <PageHeader>
                <PageTitle title={podcast.title} />
                <div className="flex items-center gap-2 mt-2">
                  {renderStatusIndicator(podcast.status)}
                </div>
              </PageHeader>

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

              {podcast.description &&
                podcast.description !== podcast.summary && (
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
                              const speakerNum = speakerId.replace(
                                "SPEAKER_",
                                "",
                              );
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
      ) : (
        <div className="bg-off-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl p-8 text-center">
          <h3 className="text-xl font-semibold mb-4 text-zinc-800 dark:text-zinc-200">
            Podcast not found
          </h3>
          <p className="text-zinc-600 dark:text-zinc-400 mb-6">
            The podcast you're looking for doesn't exist or was removed.
          </p>
          <Link to="/apps/podcasts">
            <Button variant="primary">Go to Podcasts</Button>
          </Link>
        </div>
      )}
    </PageShell>
  );
}
