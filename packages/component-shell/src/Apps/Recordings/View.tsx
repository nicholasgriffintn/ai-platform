import {
  formatRecordingCaptions,
  RecordingDetailView,
  type RecordingCaptionFormat,
} from "@ngriffin_uk/polychat-component-experiences/content";
import type { Recording } from "@ngriffin_uk/polychat-schemas";
import { downloadTextFile } from "@ngriffin_uk/polychat-utility-react";
import { useCallback } from "react";

function recordingFilename(recording: Recording, suffix: string): string {
  return `${recording.title.replace(/\s+/g, "-")}-${suffix}`;
}

export function RecordingView({ recording }: { recording: Recording }) {
  const handleDownloadTranscript = useCallback(() => {
    if (!recording?.transcript) {
      return;
    }

    const transcriptText =
      typeof recording.transcript === "string"
        ? recording.transcript
        : recording.transcript.segments.map((seg) => `[${seg.speaker}] ${seg.text}`).join("\n\n");

    downloadTextFile(recordingFilename(recording, "transcript.txt"), transcriptText);
  }, [recording]);

  const handleDownloadCaptions = useCallback(
    (format: RecordingCaptionFormat) => {
      if (!recording?.transcript || typeof recording.transcript === "string") {
        return;
      }

      downloadTextFile(
        recordingFilename(recording, `captions.${format}`),
        formatRecordingCaptions(recording.transcript, format),
        format === "vtt" ? "text/vtt" : "application/x-subrip",
      );
    },
    [recording],
  );

  return (
    <RecordingDetailView
      recording={recording}
      onDownloadTranscript={handleDownloadTranscript}
      onDownloadCaptions={handleDownloadCaptions}
    />
  );
}
