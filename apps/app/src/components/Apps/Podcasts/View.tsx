import { PodcastDetailView } from "@ngriffin_uk/polychat-component-experiences/content";
import type { Podcast } from "@ngriffin_uk/polychat-schemas";
import { useCallback } from "react";

export function PodcastView({ podcast }: { podcast: Podcast }) {
  const handleDownloadTranscript = useCallback(() => {
    if (!podcast?.transcript) {
      return;
    }

    const transcriptText =
      typeof podcast.transcript === "string"
        ? podcast.transcript
        : podcast.transcript.segments.map((seg) => `[${seg.speaker}] ${seg.text}`).join("\n\n");

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

  return <PodcastDetailView podcast={podcast} onDownloadTranscript={handleDownloadTranscript} />;
}
