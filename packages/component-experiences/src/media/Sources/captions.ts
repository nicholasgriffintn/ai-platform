import type { SourceTranscript } from "@ngriffin_uk/polychat-schemas";
import {
  formatSrt,
  formatVtt,
  splitSegmentsIntoCues,
  type TimedSegment,
} from "@ngriffin_uk/polychat-utility-core";

export type CaptionFormat = "srt" | "vtt";

type TranscriptSegments = Pick<SourceTranscript, "segments" | "speakers">;

export function transcriptSpeakerNames(transcript: TranscriptSegments): Record<string, string> {
  return transcript.segments.reduce<Record<string, string>>((names, segment, index) => {
    const speakerId = segment.speaker ?? `Segment ${index + 1}`;

    if (!names[speakerId]) {
      const speakerNumber = speakerId.startsWith("SPEAKER_")
        ? Number.parseInt(speakerId.replace("SPEAKER_", ""), 10)
        : index;

      names[speakerId] = transcript.speakers[speakerId] ?? `Speaker ${speakerNumber + 1}`;
    }

    return names;
  }, {});
}

export function transcriptCaptionCues(transcript: TranscriptSegments): TimedSegment[] {
  const timedSegments = transcript.segments.flatMap((segment) =>
    segment.start === undefined || segment.end === undefined
      ? []
      : [
          {
            start: segment.start,
            end: segment.end,
            text: segment.text,
            ...(segment.speaker === undefined ? {} : { speaker: segment.speaker }),
          },
        ],
  );

  return splitSegmentsIntoCues(timedSegments);
}

export function formatTranscriptCaptions(
  transcript: TranscriptSegments,
  format: CaptionFormat,
): string {
  const cues = transcriptCaptionCues(transcript);
  const speakerNames = transcriptSpeakerNames(transcript);

  return format === "srt" ? formatSrt(cues, speakerNames) : formatVtt(cues, speakerNames);
}
