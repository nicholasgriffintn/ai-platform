import { RecordingDetailView } from "@ngriffin_uk/polychat-component-experiences/content";
import type { Recording } from "@ngriffin_uk/polychat-schemas";
import { useCallback } from "react";

import { useRecordingActionItemTasks } from "./useRecordingActionItemTasks.js";

export function RecordingView({
  recording,
  projectId,
}: {
  recording: Recording;
  projectId?: string;
}) {
  const actionItemTasks = useRecordingActionItemTasks(projectId, recording.title);

  const handleDownloadTranscript = useCallback(() => {
    if (!recording?.transcript) {
      return;
    }

    const transcriptText =
      typeof recording.transcript === "string"
        ? recording.transcript
        : recording.transcript.segments.map((seg) => `[${seg.speaker}] ${seg.text}`).join("\n\n");

    const blob = new Blob([transcriptText], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");

    a.href = url;
    a.download = `${recording.title.replace(/\s+/g, "-")}-transcript.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [recording]);

  return (
    <>
      {actionItemTasks.error && (
        <p role="alert" className="text-sm text-failure">
          {actionItemTasks.error}
        </p>
      )}
      <RecordingDetailView
        recording={recording}
        onDownloadTranscript={handleDownloadTranscript}
        onAddActionItem={
          actionItemTasks.canAdd
            ? (item, index) => void actionItemTasks.addActionItem(item, index)
            : undefined
        }
        addedActionItems={actionItemTasks.added}
        addingActionItem={actionItemTasks.adding}
      />
    </>
  );
}
