import { base64ToArrayBuffer, decodePcm16Audio } from "./audio";

export interface MediaStreamAudioLevelMeter {
	stop: () => void;
}

interface CreateMediaStreamAudioLevelMeterOptions {
	onLevel: (level: number) => void;
	stream: MediaStream;
	updateIntervalMs?: number;
}

const AUDIO_LEVEL_SCALE = 4;
const DEFAULT_UPDATE_INTERVAL_MS = 80;
const METER_FFT_SIZE = 256;

function clampAudioLevel(level: number): number {
	if (!Number.isFinite(level)) {
		return 0;
	}

	return Math.min(1, Math.max(0, level));
}

export function calculateNormalisedAudioLevel(samples: Float32Array): number {
	if (samples.length === 0) {
		return 0;
	}

	let sumOfSquares = 0;
	for (const sample of samples) {
		sumOfSquares += sample * sample;
	}

	return clampAudioLevel(Math.sqrt(sumOfSquares / samples.length) * AUDIO_LEVEL_SCALE);
}

export function calculatePcm16Base64AudioLevel(base64Audio: string): number {
	return calculateNormalisedAudioLevel(decodePcm16Audio(base64ToArrayBuffer(base64Audio)));
}

export function createMediaStreamAudioLevelMeter({
	onLevel,
	stream,
	updateIntervalMs = DEFAULT_UPDATE_INTERVAL_MS,
}: CreateMediaStreamAudioLevelMeterOptions): MediaStreamAudioLevelMeter {
	const hasAudioTrack = stream.getTracks().some((track) => track.kind === "audio");
	if (!hasAudioTrack || !window.AudioContext) {
		onLevel(0);
		return { stop: () => onLevel(0) };
	}

	const audioContext = new AudioContext();
	const source = audioContext.createMediaStreamSource(stream);
	const analyser = audioContext.createAnalyser();
	const samples = new Float32Array(METER_FFT_SIZE);
	let animationFrameId: number | null = null;
	let lastUpdateAt = 0;
	let stopped = false;

	analyser.fftSize = METER_FFT_SIZE;
	source.connect(analyser);

	const updateLevel = (timestamp: number) => {
		if (stopped) {
			return;
		}

		animationFrameId = window.requestAnimationFrame(updateLevel);
		if (timestamp - lastUpdateAt < updateIntervalMs) {
			return;
		}

		lastUpdateAt = timestamp;
		analyser.getFloatTimeDomainData(samples);
		onLevel(calculateNormalisedAudioLevel(samples));
	};

	animationFrameId = window.requestAnimationFrame(updateLevel);

	return {
		stop: () => {
			stopped = true;
			if (animationFrameId !== null) {
				window.cancelAnimationFrame(animationFrameId);
			}
			source.disconnect();
			analyser.disconnect();
			void audioContext.close();
			onLevel(0);
		},
	};
}
