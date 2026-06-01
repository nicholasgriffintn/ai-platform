import { describe, expect, it } from "vitest";

import { calculateNormalisedAudioLevel, createMediaStreamAudioLevelMeter } from "./audio-levels";

describe("realtime audio level helpers", () => {
	it("normalises PCM samples to a bounded meter value", () => {
		expect(calculateNormalisedAudioLevel(new Float32Array([]))).toBe(0);
		expect(calculateNormalisedAudioLevel(new Float32Array([0, 0, 0]))).toBe(0);
		expect(calculateNormalisedAudioLevel(new Float32Array([0.25, -0.25]))).toBe(1);
		expect(calculateNormalisedAudioLevel(new Float32Array([1, -1]))).toBe(1);
	});

	it("returns a no-op meter when the stream has no audio track", () => {
		const levels: number[] = [];
		const meter = createMediaStreamAudioLevelMeter({
			stream: {
				getTracks: () => [{ kind: "video" }],
			} as MediaStream,
			onLevel: (level) => levels.push(level),
		});

		meter.stop();

		expect(levels).toEqual([0, 0]);
	});
});
