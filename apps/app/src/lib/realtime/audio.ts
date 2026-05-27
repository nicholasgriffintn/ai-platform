export interface RealtimeMediaController {
	stop: () => void;
}

export interface Pcm16AudioPlayer {
	playBase64: (base64Audio: string) => void;
	stop: () => void;
}

const PCM_SAMPLE_MAX = 0x7fff;
const PCM_SAMPLE_MIN = 0x8000;

function getAudioContextConstructor(): typeof AudioContext {
	const AudioContextConstructor =
		window.AudioContext ||
		(window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

	if (!AudioContextConstructor) {
		throw new Error("Web Audio is not supported in this browser");
	}

	return AudioContextConstructor;
}

export function arrayBufferToBase64(buffer: ArrayBuffer): string {
	let binary = "";
	const bytes = new Uint8Array(buffer);
	for (let index = 0; index < bytes.byteLength; index += 1) {
		binary += String.fromCharCode(bytes[index]);
	}

	return btoa(binary);
}

export function base64ToArrayBuffer(base64: string): ArrayBuffer {
	const binary = atob(base64);
	const bytes = new Uint8Array(binary.length);
	for (let index = 0; index < binary.length; index += 1) {
		bytes[index] = binary.charCodeAt(index);
	}

	return bytes.buffer;
}

export function downsampleFloat32Buffer(
	input: Float32Array,
	inputSampleRate: number,
	outputSampleRate: number,
): Float32Array {
	if (outputSampleRate === inputSampleRate) {
		return input.slice();
	}

	if (outputSampleRate > inputSampleRate) {
		throw new Error("Output sample rate must be lower than input sample rate");
	}

	const ratio = inputSampleRate / outputSampleRate;
	const outputLength = Math.floor(input.length / ratio);
	const output = new Float32Array(outputLength);

	for (let outputIndex = 0; outputIndex < outputLength; outputIndex += 1) {
		const start = Math.floor(outputIndex * ratio);
		const end = Math.min(Math.floor((outputIndex + 1) * ratio), input.length);
		let sum = 0;
		for (let inputIndex = start; inputIndex < end; inputIndex += 1) {
			sum += input[inputIndex];
		}
		output[outputIndex] = sum / Math.max(end - start, 1);
	}

	return output;
}

export function encodePcm16Audio(input: Float32Array): ArrayBuffer {
	const buffer = new ArrayBuffer(input.length * 2);
	const view = new DataView(buffer);

	for (let index = 0; index < input.length; index += 1) {
		const sample = Math.max(-1, Math.min(1, input[index]));
		view.setInt16(index * 2, sample < 0 ? sample * PCM_SAMPLE_MIN : sample * PCM_SAMPLE_MAX, true);
	}

	return buffer;
}

export function decodePcm16Audio(buffer: ArrayBuffer): Float32Array {
	const view = new DataView(buffer);
	const output = new Float32Array(buffer.byteLength / 2);

	for (let index = 0; index < output.length; index += 1) {
		const sample = view.getInt16(index * 2, true);
		output[index] = sample / (sample < 0 ? PCM_SAMPLE_MIN : PCM_SAMPLE_MAX);
	}

	return output;
}

export async function startPcm16MicrophoneStream({
	onChunk,
	sampleRate = 16000,
	stream,
}: {
	onChunk: (chunk: ArrayBuffer) => void;
	sampleRate?: number;
	stream: MediaStream;
}): Promise<RealtimeMediaController> {
	const AudioContextConstructor = getAudioContextConstructor();
	const audioContext = new AudioContextConstructor();
	const source = audioContext.createMediaStreamSource(stream);
	const processor = audioContext.createScriptProcessor(4096, 1, 1);
	const silentOutput = audioContext.createGain();
	silentOutput.gain.value = 0;

	processor.onaudioprocess = (event) => {
		const input = event.inputBuffer.getChannelData(0);
		const sampled = downsampleFloat32Buffer(input, audioContext.sampleRate, sampleRate);
		onChunk(encodePcm16Audio(sampled));
	};

	source.connect(processor);
	processor.connect(silentOutput);
	silentOutput.connect(audioContext.destination);

	return {
		stop: () => {
			processor.disconnect();
			source.disconnect();
			silentOutput.disconnect();
			void audioContext.close();
		},
	};
}

export async function startJpegFrameStream({
	intervalMs = 1000,
	onFrame,
	stream,
}: {
	intervalMs?: number;
	onFrame: (frame: { data: string; mimeType: "image/jpeg" }) => void;
	stream: MediaStream;
}): Promise<RealtimeMediaController> {
	const videoTrack = stream.getVideoTracks()[0];
	if (!videoTrack) {
		return { stop: () => {} };
	}

	const video = document.createElement("video");
	video.muted = true;
	video.playsInline = true;
	video.srcObject = new MediaStream([videoTrack]);
	await video.play();

	const canvas = document.createElement("canvas");
	const context = canvas.getContext("2d");
	if (!context) {
		throw new Error("Canvas is not supported in this browser");
	}

	const sendFrame = () => {
		const width = video.videoWidth || 640;
		const height = video.videoHeight || 360;
		canvas.width = width;
		canvas.height = height;
		context.drawImage(video, 0, 0, width, height);
		const dataUrl = canvas.toDataURL("image/jpeg", 0.72);
		const [, data = ""] = dataUrl.split(",");
		if (data) {
			onFrame({ data, mimeType: "image/jpeg" });
		}
	};

	const intervalId = window.setInterval(sendFrame, intervalMs);
	sendFrame();

	return {
		stop: () => {
			window.clearInterval(intervalId);
			video.pause();
			video.srcObject = null;
		},
	};
}

export function createPcm16AudioPlayer({ sampleRate = 24000 } = {}): Pcm16AudioPlayer {
	const AudioContextConstructor = getAudioContextConstructor();
	const audioContext = new AudioContextConstructor();
	const sources = new Set<AudioBufferSourceNode>();
	let nextStartTime = audioContext.currentTime;

	return {
		playBase64: (base64Audio: string) => {
			const samples = decodePcm16Audio(base64ToArrayBuffer(base64Audio));
			const audioBuffer = audioContext.createBuffer(1, samples.length, sampleRate);
			audioBuffer.getChannelData(0).set(samples);

			const source = audioContext.createBufferSource();
			source.buffer = audioBuffer;
			source.connect(audioContext.destination);
			source.onended = () => sources.delete(source);
			sources.add(source);

			const startAt = Math.max(audioContext.currentTime, nextStartTime);
			source.start(startAt);
			nextStartTime = startAt + audioBuffer.duration;
		},
		stop: () => {
			for (const source of sources) {
				try {
					source.stop();
				} catch {
					// The source may already have finished playback.
				}
			}
			sources.clear();
			void audioContext.close();
		},
	};
}
