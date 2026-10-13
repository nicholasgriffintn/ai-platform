import { afterEach, describe, expect, it, vi } from "vitest";

import {
  decodePcm16Audio,
  encodePcm16Wav,
  requestRealtimeAudioStream,
  requestRealtimeVideoStream,
  startPcm16MicrophoneStream,
} from "./audio";

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

type FakeWorkletMessageHandler = (event: { data: { input: Float32Array } }) => void;

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
    listeners: new Set<FakeWorkletMessageHandler>(),
    started: false,
    start: () => {
      this.port.started = true;
    },
    postMessage: vi.fn(),
    addEventListener: (_type: string, listener: FakeWorkletMessageHandler) => {
      this.port.listeners.add(listener);
    },
    removeEventListener: (_type: string, listener: FakeWorkletMessageHandler) => {
      this.port.listeners.delete(listener);
    },
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
    if (!this.port.started) {
      return;
    }

    for (const listener of this.port.listeners) {
      listener({ data: { input } });
    }
  }
}

class FakeAudioContext {
  static instances: FakeAudioContext[] = [];

  audioWorklet?: { addModule: ReturnType<typeof vi.fn> };
  close = vi.fn();
  state: AudioContextState = "suspended";
  resume = vi.fn(async () => {
    this.state = "running";
  });
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

  it("wraps PCM16 chunks in a mono WAV header that decoders accept", () => {
    const wav = encodePcm16Wav([new Int16Array([1, -1]).buffer, new Int16Array([7]).buffer], 16000);
    const view = new DataView(wav);
    const ascii = (offset: number) =>
      String.fromCharCode(...new Uint8Array(wav.slice(offset, offset + 4)));

    expect([ascii(0), ascii(8), ascii(12), ascii(36)]).toEqual(["RIFF", "WAVE", "fmt ", "data"]);
    expect(view.getUint32(4, true)).toBe(42);
    expect(view.getUint32(24, true)).toBe(16000);
    expect(view.getUint32(40, true)).toBe(6);
    expect(Array.from(new Int16Array(wav.slice(44)))).toEqual([1, -1, 7]);
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
    expect(audioContext.resume).toHaveBeenCalled();

    const worklet = FakeAudioWorkletNode.instances[0];

    expect(worklet.name).toBe("pcm16-microphone-processor");
    expect(worklet.options.processorOptions).toEqual({ bufferSize: 4096 });

    worklet.emit(new Float32Array([0, 1, -1]));

    expect(onChunk).toHaveBeenCalledTimes(1);
    expect(decodePcm16Audio(onChunk.mock.calls[0][0])).toEqual(new Float32Array([0, 1, -1]));

    controller.stop();

    expect(worklet.port.postMessage).toHaveBeenCalledWith({ type: "stop" });
    expect(worklet.port.listeners.size).toBe(0);
    expect(audioContext.close).toHaveBeenCalled();
  });

  it("requests deterministic realtime capture constraints from the browser", async () => {
    const audioStream = { id: "audio-stream" };
    const videoStream = { id: "video-stream" };
    const getUserMedia = vi
      .fn()
      .mockResolvedValueOnce(audioStream)
      .mockResolvedValueOnce(videoStream);

    vi.stubGlobal("navigator", { mediaDevices: { getUserMedia } });

    await expect(requestRealtimeAudioStream()).resolves.toBe(audioStream);
    await expect(requestRealtimeVideoStream("camera-fixture")).resolves.toBe(videoStream);
    expect(getUserMedia).toHaveBeenNthCalledWith(1, {
      audio: {
        autoGainControl: false,
        echoCancellation: true,
        noiseSuppression: true,
      },
    });
    expect(getUserMedia).toHaveBeenNthCalledWith(2, {
      video: {
        deviceId: { exact: "camera-fixture" },
        frameRate: { ideal: 1, max: 2 },
        height: { ideal: 360 },
        width: { ideal: 640 },
      },
    });
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
