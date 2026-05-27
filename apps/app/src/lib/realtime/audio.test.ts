import { afterEach, describe, expect, it, vi } from "vitest";

import { decodePcm16Audio, startPcm16MicrophoneStream } from "./audio";

class FakeAudioNode {
	disconnect = vi.fn();

	connect(node: AudioNode): AudioNode {
		return node;
	}
}

class FakeGainNode extends FakeAudioNode {
	gain = { value: 1 };
}

interface FakeAudioProcessingEvent {
	inputBuffer: {
		getChannelData: () => Float32Array;
	};
}

class FakeScriptProcessorNode extends FakeAudioNode {
	onaudioprocess: ((event: FakeAudioProcessingEvent) => void) | null = null;

	emit(input: Float32Array) {
		this.onaudioprocess?.({
			inputBuffer: {
				getChannelData: () => input,
			},
		});
	}
}

class FakeAudioWorkletNode extends FakeAudioNode {
	static instances: FakeAudioWorkletNode[] = [];

	port = {
		onmessage: null as ((event: MessageEvent<{ input: Float32Array }>) => void) | null,
		postMessage: vi.fn(),
	};

	constructor(
		public context: AudioContext,
		public name: string,
		public options: AudioWorkletNodeOptions,
	) {
		super();
		FakeAudioWorkletNode.instances.push(this);
	}

	emit(input: Float32Array) {
		this.port.onmessage?.({ data: { input } } as MessageEvent<{ input: Float32Array }>);
	}
}

class FakeAudioContext {
	static instances: FakeAudioContext[] = [];

	audioWorklet?: { addModule: ReturnType<typeof vi.fn> };
	close = vi.fn();
	createGain = vi.fn(() => new FakeGainNode() as unknown as GainNode);
	createMediaStreamSource = vi.fn(
		() => new FakeAudioNode() as unknown as MediaStreamAudioSourceNode,
	);
	createScriptProcessor = vi.fn(() => {
		const processor = new FakeScriptProcessorNode();
		this.scriptProcessors.push(processor);
		return processor as unknown as ScriptProcessorNode;
	});
	destination = new FakeAudioNode() as unknown as AudioDestinationNode;
	sampleRate = 48000;
	scriptProcessors: FakeScriptProcessorNode[] = [];

	constructor({
		addModuleError,
		withAudioWorklet = true,
	}: {
		addModuleError?: Error;
		withAudioWorklet?: boolean;
	} = {}) {
		if (withAudioWorklet) {
			this.audioWorklet = {
				addModule: addModuleError
					? vi.fn().mockRejectedValue(addModuleError)
					: vi.fn().mockResolvedValue(undefined),
			};
		}
		FakeAudioContext.instances.push(this);
	}
}

function installAudioContext({
	addModuleError,
	withAudioWorklet,
}: {
	addModuleError?: Error;
	withAudioWorklet: boolean;
}) {
	FakeAudioContext.instances = [];
	FakeAudioWorkletNode.instances = [];

	class ConfiguredAudioContext extends FakeAudioContext {
		constructor() {
			super({ addModuleError, withAudioWorklet });
		}
	}

	vi.stubGlobal("AudioContext", ConfiguredAudioContext);
	vi.stubGlobal("AudioWorkletNode", withAudioWorklet ? FakeAudioWorkletNode : undefined);
}

const mediaStream = {} as MediaStream;

describe("realtime audio helpers", () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("captures microphone PCM through an AudioWorklet when available", async () => {
		installAudioContext({ withAudioWorklet: true });
		const onChunk = vi.fn();

		const controller = await startPcm16MicrophoneStream({
			onChunk,
			sampleRate: 48000,
			stream: mediaStream,
		});

		const audioContext = FakeAudioContext.instances[0];
		expect(audioContext.audioWorklet?.addModule).toHaveBeenCalledWith(
			"/realtime/pcm16-microphone-processor.js",
		);
		expect(audioContext.createScriptProcessor).not.toHaveBeenCalled();

		const worklet = FakeAudioWorkletNode.instances[0];
		expect(worklet.name).toBe("pcm16-microphone-processor");
		expect(worklet.options.processorOptions).toEqual({ bufferSize: 4096 });

		worklet.emit(new Float32Array([0, 1, -1]));

		expect(onChunk).toHaveBeenCalledTimes(1);
		expect(decodePcm16Audio(onChunk.mock.calls[0][0])).toEqual(new Float32Array([0, 1, -1]));

		controller.stop();

		expect(worklet.port.postMessage).toHaveBeenCalledWith({ type: "stop" });
		expect(audioContext.close).toHaveBeenCalled();
	});

	it("closes the audio context when the AudioWorklet module fails to load", async () => {
		const addModuleError = new Error("worklet unavailable");
		installAudioContext({ addModuleError, withAudioWorklet: true });

		await expect(
			startPcm16MicrophoneStream({
				onChunk: vi.fn(),
				sampleRate: 48000,
				stream: mediaStream,
			}),
		).rejects.toThrow(addModuleError);

		const audioContext = FakeAudioContext.instances[0];
		expect(audioContext.createScriptProcessor).not.toHaveBeenCalled();
		expect(audioContext.close).toHaveBeenCalled();
	});

	it("falls back to ScriptProcessorNode only when AudioWorklet is unavailable", async () => {
		installAudioContext({ withAudioWorklet: false });
		const onChunk = vi.fn();

		await startPcm16MicrophoneStream({
			onChunk,
			sampleRate: 48000,
			stream: mediaStream,
		});

		const audioContext = FakeAudioContext.instances[0];
		expect(audioContext.createScriptProcessor).toHaveBeenCalledWith(4096, 1, 1);
		expect(FakeAudioWorkletNode.instances).toEqual([]);

		audioContext.scriptProcessors[0].emit(new Float32Array([0, 1, -1]));

		expect(onChunk).toHaveBeenCalledTimes(1);
		expect(decodePcm16Audio(onChunk.mock.calls[0][0])).toEqual(new Float32Array([0, 1, -1]));
	});
});
