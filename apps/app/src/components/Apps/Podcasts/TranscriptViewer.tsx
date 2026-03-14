import { useEffect, useState } from "react";

import type { TranscriptData } from "~/types/podcast";

interface TranscriptViewerProps {
	transcript: TranscriptData;
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

export function TranscriptViewer({
	transcript,
	speakerNames = {},
}: TranscriptViewerProps) {
	const [speakerColors, setSpeakerColors] = useState<Record<string, string>>(
		{},
	);

	useEffect(() => {
		const uniqueSpeakers = [
			...new Set(transcript.segments.map((segment) => segment.speaker)),
		];
		const colors = {
			SPEAKER_00:
				"bg-blue-100 dark:bg-blue-900 border-blue-300 dark:border-blue-700",
			SPEAKER_01:
				"bg-green-100 dark:bg-green-900 border-green-300 dark:border-green-700",
			SPEAKER_02:
				"bg-amber-100 dark:bg-amber-900 border-amber-300 dark:border-amber-700",
			SPEAKER_03:
				"bg-purple-100 dark:bg-purple-900 border-purple-300 dark:border-purple-700",
			SPEAKER_04:
				"bg-rose-100 dark:bg-rose-900 border-rose-300 dark:border-rose-700",
			SPEAKER_05:
				"bg-cyan-100 dark:bg-cyan-900 border-cyan-300 dark:border-cyan-700",
		};

		const speakerColorMap: Record<string, string> = {};
		uniqueSpeakers.forEach((speaker, index) => {
			const colorKey = `SPEAKER_0${index % 6}` as keyof typeof colors;
			speakerColorMap[speaker] =
				colors[colorKey] ||
				"bg-gray-100 dark:bg-gray-900 border-gray-300 dark:border-gray-700";
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
				<div className="text-sm text-zinc-500">
					{transcript.num_speakers} speakers • {transcript.language}
				</div>
			</div>

			<div className="space-y-3">
				{transcript.segments.map((segment, index) => (
					<div
						key={index}
						className={`p-3 rounded-lg border ${speakerColors[segment.speaker] || "bg-gray-100 dark:bg-gray-900 border-gray-300 dark:border-gray-700"}`}
					>
						<div className="flex items-center justify-between mb-1">
							<div className="font-medium text-sm">
								{getSpeakerName(segment.speaker)}
							</div>
							<div className="text-xs text-zinc-500">
								{formatTime(segment.start)} - {formatTime(segment.end)}
							</div>
						</div>
						<p className="text-sm text-zinc-800 dark:text-zinc-200">
							{segment.text}
						</p>
					</div>
				))}
			</div>
		</div>
	);
}
