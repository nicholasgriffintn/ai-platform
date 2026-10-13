import type { RecordingTranscriptData } from "@ngriffin_uk/polychat-schemas";
import {
  formatSrt,
  formatVtt,
  splitSegmentsIntoCues,
  type TimedSegment,
} from "@ngriffin_uk/polychat-utility-core";

export type RecordingCaptionFormat = "srt" | "vtt";

export function recordingSpeakerNames(transcript: RecordingTranscriptData): Record<string, string> {
  return transcript.segments.reduce<Record<string, string>>((names, segment, index) => {
    const speakerId = segment.speaker ?? `Segment ${index + 1}`;

    if (!names[speakerId]) {
      const speakerNumber = speakerId.startsWith("SPEAKER_")
        ? Number.parseInt(speakerId.replace("SPEAKER_", ""), 10)
        : index;

      names[speakerId] = `Speaker ${speakerNumber + 1}`;
    }

    return names;
  }, {});
}

export function recordingCaptionCues(transcript: RecordingTranscriptData): TimedSegment[] {
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

export function formatRecordingCaptions(
  transcript: RecordingTranscriptData,
  format: RecordingCaptionFormat,
): string {
  const cues = recordingCaptionCues(transcript);
  const speakerNames = recordingSpeakerNames(transcript);

  return format === "srt" ? formatSrt(cues, speakerNames) : formatVtt(cues, speakerNames);
}
