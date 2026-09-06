import type { RealtimeTranscriptResult } from "@ngriffin_uk/polychat-library-realtime/messages";

export function mergeRealtimeTranscriptText(
  currentText: string,
  transcript: Pick<RealtimeTranscriptResult, "isDelta" | "text">,
): string {
  return transcript.isDelta ? `${currentText}${transcript.text}` : transcript.text;
}
