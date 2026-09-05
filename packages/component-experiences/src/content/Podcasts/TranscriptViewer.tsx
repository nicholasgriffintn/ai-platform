import type { PodcastTranscriptData } from "@ngriffin_uk/polychat-schemas";
import { useEffect, useState } from "react";

interface TranscriptViewerProps {
  transcript: PodcastTranscriptData;
  speakerNames?: Record<string, string>;
}

export function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  const parts: string[] = [];

  if (hours > 0) {
    parts.push(hours.toString().padStart(2, "0"));
  }

  parts.push(minutes.toString().padStart(2, "0"));
  parts.push(secs.toString().padStart(2, "0"));

  return parts.join(":");
}

export function TranscriptViewer({ transcript, speakerNames = {} }: TranscriptViewerProps) {
  const [speakerColors, setSpeakerColors] = useState<Record<string, string>>({});

  useEffect(() => {
    const uniqueSpeakers = [
      ...new Set(
        transcript.segments.map((segment, index) => segment.speaker ?? `Segment ${index + 1}`),
      ),
    ];
    const colors = {
      SPEAKER_00: "bg-active-work/12 border-active-work/45",
      SPEAKER_01: "bg-success/12 border-success/45",
      SPEAKER_02: "bg-attention/12 border-attention/45",
      SPEAKER_03: "bg-creative/12 border-creative/45",
      SPEAKER_04: "bg-failure/12 border-failure/45",
      SPEAKER_05: "bg-active-work/12 border-active-work/45",
    };

    const speakerColorMap: Record<string, string> = {};

    uniqueSpeakers.forEach((speaker, index) => {
      const colorKey = `SPEAKER_0${index % 6}` as keyof typeof colors;

      speakerColorMap[speaker] = colors[colorKey] || "bg-surface-elevated border-border";
    });

    setSpeakerColors(speakerColorMap);
  }, [transcript.segments]);

  const getSpeakerName = (speakerId: string): string => {
    return speakerNames[speakerId] || speakerId;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Transcript</h3>
        <div className="text-sm text-muted-foreground">
          {transcript.num_speakers ?? uniqueSpeakerCount(transcript.segments)} speakers
          {transcript.language ? ` • ${transcript.language}` : ""}
        </div>
      </div>

      <div className="space-y-3">
        {transcript.segments.map((segment, index) => (
          <div
            key={index}
            className={`p-3 rounded-lg border ${speakerColors[getSegmentSpeaker(segment.speaker, index)] || "bg-surface-elevated border-border"}`}
          >
            <div className="flex items-center justify-between mb-1">
              <div className="font-medium text-sm">
                {getSpeakerName(getSegmentSpeaker(segment.speaker, index))}
              </div>
              <div className="text-xs text-muted-foreground">
                {formatTime(segment.start ?? 0)} - {formatTime(segment.end ?? 0)}
              </div>
            </div>
            <p className="text-sm text-foreground">{segment.text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function getSegmentSpeaker(speaker: string | undefined, index: number): string {
  return speaker ?? `Segment ${index + 1}`;
}

function uniqueSpeakerCount(segments: PodcastTranscriptData["segments"]): number {
  return new Set(segments.map((segment, index) => getSegmentSpeaker(segment.speaker, index))).size;
}
