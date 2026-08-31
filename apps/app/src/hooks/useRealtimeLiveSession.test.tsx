import type {
  ConnectRealtimeWebRTCOptions,
  ConnectRealtimeWebSocketOptions,
} from "@ngriffin_uk/polychat-library-realtime";
import type { RealtimeLiveProviderOption } from "@ngriffin_uk/polychat-library-realtime/live-providers";
import { REALTIME_LIVE_PROVIDER_WEBSOCKET_CONFIG } from "@ngriffin_uk/polychat-library-realtime/websocket-protocols";
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { REALTIME_SESSION_FINALIZATION_TIMEOUT_MS } from "~/lib/realtime/live-session-controller";

import { useRealtimeLiveSession } from "./useRealtimeLiveSession";

const mocks = vi.hoisted(() => ({
  connectWebRTC: vi.fn(),
  connectWebSocket: vi.fn(),
  createRealtimeSession: vi.fn(),
  listVideoDevices: vi.fn(async () => []),
  requestAudioStream: vi.fn(),
  requestVideoStream: vi.fn(),
  setMediaStreamTrackEnabled: vi.fn(),
  startJpegFrameStream: vi.fn(),
  startPcm16MicrophoneStream: vi.fn(),
  stopMediaStream: vi.fn((stream?: MediaStream | null) => {
    for (const track of stream?.getTracks() ?? []) {
      track.stop();
    }
  }),
  toastError: vi.fn(),
  webRtcConnections: [] as Array<{
    close: ReturnType<typeof vi.fn>;
    options: ConnectRealtimeWebRTCOptions;
  }>,
  webSocketConnections: [] as Array<{
    close: ReturnType<typeof vi.fn>;
    options: ConnectRealtimeWebSocketOptions;
    sendJson: ReturnType<typeof vi.fn>;
    session: Record<string, unknown>;
    socket: { readyState: number; send: ReturnType<typeof vi.fn> };
  }>,
}));

vi.mock("~/lib/api/realtime-service", () => ({
  createRealtimeSession: mocks.createRealtimeSession,
}));

vi.mock("sonner", () => ({ toast: { error: mocks.toastError } }));

vi.mock("@ngriffin_uk/polychat-library-realtime", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@ngriffin_uk/polychat-library-realtime")>();

  return {
    ...actual,
    connectRealtimeWebRTC: mocks.connectWebRTC,
    connectRealtimeWebSocket: mocks.connectWebSocket,
    preferOpusAudioCodec: vi.fn(),
    sendBinaryWhenOpen: (
      connection: { socket: { send: (payload: ArrayBuffer) => void } },
      payload: ArrayBuffer,
    ) => connection.socket.send(payload),
    sendJsonWhenOpen: (connection: { sendJson: (payload: unknown) => void }, payload: unknown) =>
      connection.sendJson(payload),
  };
});

vi.mock("@ngriffin_uk/polychat-library-realtime/audio", () => ({
  arrayBufferToBase64: vi.fn(() => "audio"),
  createPcm16AudioPlayer: vi.fn(() => ({ playBase64: vi.fn(), stop: vi.fn() })),
  listRealtimeVideoInputDevices: mocks.listVideoDevices,
  requestRealtimeAudioStream: mocks.requestAudioStream,
  requestRealtimeVideoStream: mocks.requestVideoStream,
  setMediaStreamTrackEnabled: mocks.setMediaStreamTrackEnabled,
  startJpegFrameStream: mocks.startJpegFrameStream,
  startPcm16MicrophoneStream: mocks.startPcm16MicrophoneStream,
  stopMediaStream: mocks.stopMediaStream,
}));

vi.mock("@ngriffin_uk/polychat-library-realtime/audio-levels", () => ({
  calculatePcm16AudioLevel: vi.fn(() => 0),
  calculatePcm16Base64AudioLevel: vi.fn(() => 0),
  createMediaStreamAudioLevelMeter: vi.fn(() => ({ stop: vi.fn() })),
}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((next) => {
    resolve = next;
  });

  return { promise, resolve };
}

function fakeAudioStream() {
  const stop = vi.fn();
  const track = { enabled: true, kind: "audio", stop };
  const stream = {
    getAudioTracks: () => [track],
    getTracks: () => [track],
  } as unknown as MediaStream;

  return { stop, stream, track };
}

function fakeVideoStream() {
  const stop = vi.fn();
  const stream = {
    getTracks: () => [{ enabled: true, stop }],
  } as unknown as MediaStream;

  return { stop, stream };
}

function provider(
  id: "cartesia" | "openai" | "mistral",
  transport: "webrtc" | "websocket",
): RealtimeLiveProviderOption {
  const isOpenAI = id === "openai";
  const isCartesia = id === "cartesia";

  return {
    id,
    label: isOpenAI ? "OpenAI Realtime" : `${id} Realtime`,
    shortLabel: isOpenAI ? "OpenAI" : id,
    order: isOpenAI ? 0 : isCartesia ? 2 : 1,
    liveMode: isOpenAI ? "native" : "composed",
    transport,
    sessionType: isOpenAI ? "realtime" : "transcription",
    inputModalities: ["audio"],
    outputModalities: isOpenAI ? ["audio"] : ["text"],
    description: "Test provider",
    defaultModelId: `${id}-model`,
    available: true,
    readiness: "ready",
    availabilityReason: `${id} is ready`,
    websocket:
      transport === "websocket"
        ? {
            audioInput: {
              ...(isCartesia
                ? { chunkEncoding: "binary" as const }
                : { buildAppendMessage: (audio: string) => ({ audio }) }),
              endMessages: [{ type: "input_audio.end" }],
              ...(isCartesia
                ? { keepSendingSilenceWhenMuted: true, waitForSocketCloseOnStop: true }
                : { waitForFinalEventTypeOnStop: "transcription.done" }),
            },
            closeErrorLabel: "Mistral",
            connectedEventLabel: "Connected",
            connectionFailedMessage: "Connection failed",
            mediaStartFailedMessage: "Media failed",
            startingMediaEventLabel: "Starting media",
          }
        : undefined,
  };
}

function googleProvider(): RealtimeLiveProviderOption {
  return {
    id: "google-ai-studio",
    label: "Google AI Studio",
    shortLabel: "Google",
    order: 1,
    liveMode: "native",
    transport: "websocket",
    sessionType: "realtime",
    inputModalities: ["audio", "text", "image"],
    outputModalities: ["audio", "text"],
    description: "Test provider",
    defaultModelId: "gemini-live-model",
    available: true,
    readiness: "ready",
    availabilityReason: "Google is ready",
    websocket: REALTIME_LIVE_PROVIDER_WEBSOCKET_CONFIG["google-ai-studio"],
  };
}

function googleSession() {
  return {
    provider: "google-ai-studio",
    transport: "websocket",
    protocol: "gemini-live",
    url: "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContentConstrained",
    setup: {
      model: "models/gemini-live-model",
      sessionResumption: {},
      contextWindowCompression: { slidingWindow: {} },
    },
  };
}

async function flushMicrotasks(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

describe("useRealtimeLiveSession lifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.webRtcConnections.length = 0;
    mocks.webSocketConnections.length = 0;
    mocks.listVideoDevices.mockResolvedValue([]);
    mocks.requestVideoStream.mockRejectedValue(new Error("Video was not expected"));
    mocks.startPcm16MicrophoneStream.mockResolvedValue({ stop: vi.fn() });
    mocks.startJpegFrameStream.mockResolvedValue({ stop: vi.fn() });
    vi.stubGlobal(
      "Audio",
      class {
        autoplay = false;
        srcObject: MediaStream | null = null;
        load = vi.fn();
        pause = vi.fn();
        play = vi.fn(async () => undefined);
        removeAttribute = vi.fn();
      },
    );

    mocks.connectWebRTC.mockImplementation(async (options: ConnectRealtimeWebRTCOptions) => {
      const connection = { close: vi.fn(), options };

      mocks.webRtcConnections.push(connection);

      return { close: connection.close, session: options.session };
    });
    mocks.connectWebSocket.mockImplementation((options: ConnectRealtimeWebSocketOptions) => {
      const connection = {
        close: vi.fn(),
        options,
        sendJson: vi.fn(),
        session: options.session,
        socket: { readyState: 1, send: vi.fn() },
      };

      mocks.webSocketConnections.push(connection);

      return connection;
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("ignores callbacks from a superseded WebRTC session", async () => {
    const firstAudio = fakeAudioStream();
    const secondAudio = fakeAudioStream();

    mocks.requestAudioStream
      .mockResolvedValueOnce(firstAudio.stream)
      .mockResolvedValueOnce(secondAudio.stream);
    mocks.createRealtimeSession.mockResolvedValue({
      provider: "openai",
      transport: "webrtc",
    });
    const providers = [provider("openai", "webrtc")];
    const { result } = renderHook(() => useRealtimeLiveSession({ providers }));

    await act(async () => result.current.start("openai"));
    act(() => result.current.stop());
    await act(async () => result.current.start("openai"));

    act(() => {
      mocks.webRtcConnections[0].options.onDataChannelClose?.(new Event("close"));
    });

    expect(result.current.status).toBe("active");
    expect(result.current.error).toBeNull();
    expect(mocks.toastError).not.toHaveBeenCalled();
  });

  it("releases microphone media that resolves after finalization starts", async () => {
    vi.useFakeTimers();
    const pendingAudio = deferred<MediaStream>();
    const audio = fakeAudioStream();

    mocks.requestAudioStream.mockReturnValue(pendingAudio.promise);
    mocks.createRealtimeSession.mockResolvedValue({
      provider: "mistral",
      transport: "websocket",
      url: "wss://api.polychat.test/realtime",
    });
    const providers = [provider("mistral", "websocket")];
    const { result } = renderHook(() => useRealtimeLiveSession({ providers }));

    await act(async () => result.current.start("mistral"));
    act(() => mocks.webSocketConnections[0].options.onOpen?.(new Event("open")));
    act(() => result.current.stop());
    await act(async () => {
      pendingAudio.resolve(audio.stream);
      await flushMicrotasks();
    });

    expect(audio.stop).toHaveBeenCalled();
    expect(mocks.startPcm16MicrophoneStream).not.toHaveBeenCalled();
  });

  it("closes a finalizing WebSocket when its final event never arrives", async () => {
    vi.useFakeTimers();
    const audio = fakeAudioStream();

    mocks.requestAudioStream.mockResolvedValue(audio.stream);
    mocks.createRealtimeSession.mockResolvedValue({
      provider: "mistral",
      transport: "websocket",
      url: "wss://api.polychat.test/realtime",
    });
    const providers = [provider("mistral", "websocket")];
    const { result } = renderHook(() => useRealtimeLiveSession({ providers }));

    await act(async () => result.current.start("mistral"));
    await act(async () => {
      mocks.webSocketConnections[0].options.onOpen?.(new Event("open"));
      await flushMicrotasks();
    });
    act(() => result.current.stop());
    act(() => vi.advanceTimersByTime(REALTIME_SESSION_FINALIZATION_TIMEOUT_MS));

    expect(mocks.webSocketConnections[0].close).toHaveBeenCalledOnce();
  });

  it("closes a finalizing WebSocket as soon as its final event arrives", async () => {
    const audio = fakeAudioStream();

    mocks.requestAudioStream.mockResolvedValue(audio.stream);
    mocks.createRealtimeSession.mockResolvedValue({
      provider: "mistral",
      transport: "websocket",
      url: "wss://api.polychat.test/realtime",
    });
    const providers = [provider("mistral", "websocket")];
    const { result } = renderHook(() => useRealtimeLiveSession({ providers }));

    await act(async () => result.current.start("mistral"));
    await act(async () => {
      mocks.webSocketConnections[0].options.onOpen?.(new Event("open"));
      await flushMicrotasks();
    });
    act(() => result.current.stop());
    await act(async () => {
      mocks.webSocketConnections[0].options.onMessage?.(
        new MessageEvent("message", {
          data: JSON.stringify({ type: "transcription.done" }),
        }),
      );
      await flushMicrotasks();
    });

    expect(mocks.webSocketConnections[0].close).toHaveBeenCalledOnce();
  });

  it("streams raw PCM to Cartesia and drains until the server closes", async () => {
    const audio = fakeAudioStream();
    const onTranscript = vi.fn();

    mocks.requestAudioStream.mockResolvedValue(audio.stream);
    mocks.createRealtimeSession.mockResolvedValue({
      provider: "cartesia",
      transport: "websocket",
      url: "wss://api.polychat.test/realtime",
    });
    const providers = [provider("cartesia", "websocket")];
    const { result } = renderHook(() => useRealtimeLiveSession({ onTranscript, providers }));

    await act(async () => result.current.start("cartesia"));
    await act(async () => {
      mocks.webSocketConnections[0].options.onOpen?.(new Event("open"));
      await flushMicrotasks();
    });

    const chunk = new Uint8Array([0, 1]).buffer;

    act(() => mocks.startPcm16MicrophoneStream.mock.calls[0][0].onChunk(chunk));
    expect(mocks.webSocketConnections[0].socket.send).toHaveBeenCalledWith(chunk);

    await act(async () => {
      mocks.webSocketConnections[0].options.onMessage?.(
        new MessageEvent("message", {
          data: JSON.stringify({ type: "turn.update", transcript: "Book the" }),
        }),
      );
      await flushMicrotasks();
    });

    act(() => result.current.stop());
    expect(mocks.webSocketConnections[0].sendJson).toHaveBeenCalledWith({
      type: "input_audio.end",
    });
    expect(mocks.webSocketConnections[0].close).not.toHaveBeenCalled();

    await act(async () => {
      mocks.webSocketConnections[0].options.onMessage?.(
        new MessageEvent("message", {
          data: JSON.stringify({ type: "turn.end", transcript: "Book the train." }),
        }),
      );
      await flushMicrotasks();
    });

    act(() => {
      mocks.webSocketConnections[0].options.onClose?.(
        new CloseEvent("close", { code: 1000, reason: "drained" }),
      );
    });

    expect(result.current.status).toBe("idle");
    expect(mocks.toastError).not.toHaveBeenCalled();
    expect(onTranscript.mock.calls.map(([transcript]) => transcript)).toEqual([
      expect.objectContaining({ text: "Book the", isFinal: false }),
      expect.objectContaining({ text: "Book the train.", isFinal: true }),
    ]);
  });

  it("keeps Cartesia audio flowing as silence while the microphone is muted", async () => {
    const audio = fakeAudioStream();
    const mediaController = { stop: vi.fn() };

    mocks.startPcm16MicrophoneStream.mockResolvedValue(mediaController);
    mocks.requestAudioStream.mockResolvedValue(audio.stream);
    mocks.createRealtimeSession.mockResolvedValue({
      provider: "cartesia",
      transport: "websocket",
      url: "wss://api.polychat.test/realtime",
    });
    const providers = [provider("cartesia", "websocket")];
    const { result } = renderHook(() => useRealtimeLiveSession({ providers }));

    await act(async () => result.current.start("cartesia"));
    await act(async () => {
      mocks.webSocketConnections[0].options.onOpen?.(new Event("open"));
      await flushMicrotasks();
    });

    act(() => result.current.setMicrophoneEnabled(false));
    expect(mocks.setMediaStreamTrackEnabled).toHaveBeenCalledWith(audio.stream, "audio", false);
    expect(mediaController.stop).not.toHaveBeenCalled();

    act(() => result.current.setMicrophoneEnabled(true));
    expect(mocks.setMediaStreamTrackEnabled).toHaveBeenCalledWith(audio.stream, "audio", true);
    expect(mocks.startPcm16MicrophoneStream).toHaveBeenCalledOnce();
  });

  it("does not duplicate Cartesia microphone startup across a rapid mute toggle", async () => {
    const audio = fakeAudioStream();
    const pendingController = deferred<{ stop: ReturnType<typeof vi.fn> }>();
    const mediaController = { stop: vi.fn() };

    mocks.startPcm16MicrophoneStream.mockReturnValue(pendingController.promise);
    mocks.requestAudioStream.mockResolvedValue(audio.stream);
    mocks.createRealtimeSession.mockResolvedValue({
      provider: "cartesia",
      transport: "websocket",
      url: "wss://api.polychat.test/realtime",
    });
    const providers = [provider("cartesia", "websocket")];
    const { result } = renderHook(() => useRealtimeLiveSession({ providers }));

    await act(async () => result.current.start("cartesia"));
    act(() => mocks.webSocketConnections[0].options.onOpen?.(new Event("open")));
    await act(flushMicrotasks);

    act(() => result.current.setMicrophoneEnabled(false));
    act(() => result.current.setMicrophoneEnabled(true));

    expect(mocks.setMediaStreamTrackEnabled).toHaveBeenCalledWith(audio.stream, "audio", false);
    expect(mocks.setMediaStreamTrackEnabled).toHaveBeenCalledWith(audio.stream, "audio", true);
    expect(mocks.startPcm16MicrophoneStream).toHaveBeenCalledOnce();

    await act(async () => {
      pendingController.resolve(mediaController);
      await flushMicrotasks();
    });

    expect(mediaController.stop).not.toHaveBeenCalled();
    expect(result.current.status).toBe("active");
  });

  it("resumes Gemini Live after GoAway without reacquiring microphone media", async () => {
    const audio = fakeAudioStream();

    mocks.requestAudioStream.mockResolvedValue(audio.stream);
    mocks.createRealtimeSession.mockResolvedValue(googleSession());
    const providers = [googleProvider()];
    const { result } = renderHook(() => useRealtimeLiveSession({ providers }));

    await act(async () => result.current.start("google-ai-studio"));
    act(() => mocks.webSocketConnections[0].options.onOpen?.(new Event("open")));

    expect(mocks.webSocketConnections[0].sendJson).toHaveBeenCalledWith({
      setup: expect.objectContaining({ sessionResumption: {} }),
    });

    await act(async () => {
      mocks.webSocketConnections[0].options.onMessage?.(
        new MessageEvent("message", {
          data: JSON.stringify({ setupComplete: {} }),
        }),
      );
      await flushMicrotasks();
    });
    await act(async () => {
      mocks.webSocketConnections[0].options.onMessage?.(
        new MessageEvent("message", {
          data: JSON.stringify({
            sessionResumptionUpdate: { resumable: true, newHandle: "resume-handle" },
          }),
        }),
      );
      mocks.webSocketConnections[0].options.onMessage?.(
        new MessageEvent("message", {
          data: JSON.stringify({ goAway: { timeLeft: "10s" } }),
        }),
      );
      await flushMicrotasks();
    });

    expect(mocks.webSocketConnections).toHaveLength(2);
    expect(mocks.webSocketConnections[0].close).toHaveBeenCalledOnce();
    expect(mocks.requestAudioStream).toHaveBeenCalledOnce();

    act(() => mocks.webSocketConnections[1].options.onOpen?.(new Event("open")));
    expect(mocks.webSocketConnections[1].sendJson).toHaveBeenCalledWith({
      setup: expect.objectContaining({
        sessionResumption: { handle: "resume-handle" },
      }),
    });

    await act(async () => {
      mocks.webSocketConnections[1].options.onMessage?.(
        new MessageEvent("message", {
          data: JSON.stringify({ setupComplete: {} }),
        }),
      );
      await flushMicrotasks();
    });

    expect(result.current.status).toBe("active");
    expect(mocks.requestAudioStream).toHaveBeenCalledOnce();
    expect(mocks.startPcm16MicrophoneStream).toHaveBeenCalledTimes(2);
  });

  it("keeps resumed Gemini media alive when the old publisher finishes starting late", async () => {
    const audio = fakeAudioStream();
    const pendingController = deferred<{ stop: ReturnType<typeof vi.fn> }>();
    const staleController = { stop: vi.fn() };

    mocks.requestAudioStream.mockResolvedValue(audio.stream);
    mocks.startPcm16MicrophoneStream
      .mockReturnValueOnce(pendingController.promise)
      .mockResolvedValueOnce({ stop: vi.fn() });
    mocks.createRealtimeSession.mockResolvedValue(googleSession());
    const providers = [googleProvider()];
    const { result } = renderHook(() => useRealtimeLiveSession({ providers }));

    await act(async () => result.current.start("google-ai-studio"));
    act(() => mocks.webSocketConnections[0].options.onOpen?.(new Event("open")));
    await act(async () => {
      mocks.webSocketConnections[0].options.onMessage?.(
        new MessageEvent("message", { data: JSON.stringify({ setupComplete: {} }) }),
      );
      await flushMicrotasks();
    });
    await act(async () => {
      mocks.webSocketConnections[0].options.onMessage?.(
        new MessageEvent("message", {
          data: JSON.stringify({
            sessionResumptionUpdate: { resumable: true, newHandle: "resume-handle" },
          }),
        }),
      );
      mocks.webSocketConnections[0].options.onMessage?.(
        new MessageEvent("message", {
          data: JSON.stringify({ goAway: { timeLeft: "10s" } }),
        }),
      );
      await flushMicrotasks();
    });
    act(() => mocks.webSocketConnections[1].options.onOpen?.(new Event("open")));
    await act(async () => {
      mocks.webSocketConnections[1].options.onMessage?.(
        new MessageEvent("message", { data: JSON.stringify({ setupComplete: {} }) }),
      );
      await flushMicrotasks();
    });
    await act(async () => {
      pendingController.resolve(staleController);
      await flushMicrotasks();
    });

    expect(staleController.stop).toHaveBeenCalledOnce();
    expect(audio.stop).not.toHaveBeenCalled();
    expect(mocks.requestAudioStream).toHaveBeenCalledOnce();
    expect(result.current.status).toBe("active");
  });

  it("keeps resumed Gemini video alive when the old frame publisher starts late", async () => {
    const audio = fakeAudioStream();
    const preview = fakeVideoStream();
    const video = fakeVideoStream();
    const pendingController = deferred<{ stop: ReturnType<typeof vi.fn> }>();
    const staleController = { stop: vi.fn() };

    mocks.requestAudioStream.mockResolvedValue(audio.stream);
    mocks.requestVideoStream
      .mockResolvedValueOnce(preview.stream)
      .mockResolvedValueOnce(video.stream);
    mocks.startJpegFrameStream
      .mockReturnValueOnce(pendingController.promise)
      .mockResolvedValueOnce({ stop: vi.fn() });
    mocks.createRealtimeSession.mockResolvedValue(googleSession());
    const providers = [googleProvider()];
    const { result } = renderHook(() => useRealtimeLiveSession({ providers }));

    act(() => result.current.setProvider("google-ai-studio"));
    await act(async () => {
      result.current.setVideoEnabled(true);
      await flushMicrotasks();
    });
    await act(async () => result.current.start("google-ai-studio"));
    act(() => mocks.webSocketConnections[0].options.onOpen?.(new Event("open")));
    await act(async () => {
      mocks.webSocketConnections[0].options.onMessage?.(
        new MessageEvent("message", { data: JSON.stringify({ setupComplete: {} }) }),
      );
      await flushMicrotasks();
    });
    await act(async () => {
      mocks.webSocketConnections[0].options.onMessage?.(
        new MessageEvent("message", {
          data: JSON.stringify({
            sessionResumptionUpdate: { resumable: true, newHandle: "resume-handle" },
          }),
        }),
      );
      mocks.webSocketConnections[0].options.onMessage?.(
        new MessageEvent("message", {
          data: JSON.stringify({ goAway: { timeLeft: "10s" } }),
        }),
      );
      await flushMicrotasks();
    });
    act(() => mocks.webSocketConnections[1].options.onOpen?.(new Event("open")));
    await act(async () => {
      mocks.webSocketConnections[1].options.onMessage?.(
        new MessageEvent("message", { data: JSON.stringify({ setupComplete: {} }) }),
      );
      await flushMicrotasks();
    });
    await act(async () => {
      pendingController.resolve(staleController);
      await flushMicrotasks();
    });

    expect(staleController.stop).toHaveBeenCalledOnce();
    expect(preview.stop).toHaveBeenCalledOnce();
    expect(video.stop).not.toHaveBeenCalled();
    expect(mocks.requestVideoStream).toHaveBeenCalledTimes(2);
    expect(result.current.status).toBe("active");
  });

  it("does not let delayed audio startup interfere with replacement video startup", async () => {
    const audio = fakeAudioStream();
    const preview = fakeVideoStream();
    const video = fakeVideoStream();
    const pendingOldAudio = deferred<{ stop: ReturnType<typeof vi.fn> }>();
    const pendingReplacementVideo = deferred<{ stop: ReturnType<typeof vi.fn> }>();
    const staleAudioController = { stop: vi.fn() };

    mocks.requestAudioStream.mockResolvedValue(audio.stream);
    mocks.requestVideoStream
      .mockResolvedValueOnce(preview.stream)
      .mockResolvedValueOnce(video.stream);
    mocks.startPcm16MicrophoneStream
      .mockReturnValueOnce(pendingOldAudio.promise)
      .mockResolvedValueOnce({ stop: vi.fn() });
    mocks.startJpegFrameStream.mockReturnValueOnce(pendingReplacementVideo.promise);
    mocks.createRealtimeSession.mockResolvedValue(googleSession());
    const providers = [googleProvider()];
    const { result } = renderHook(() => useRealtimeLiveSession({ providers }));

    act(() => result.current.setProvider("google-ai-studio"));
    await act(async () => {
      result.current.setVideoEnabled(true);
      await flushMicrotasks();
    });
    await act(async () => result.current.start("google-ai-studio"));
    act(() => mocks.webSocketConnections[0].options.onOpen?.(new Event("open")));
    await act(async () => {
      mocks.webSocketConnections[0].options.onMessage?.(
        new MessageEvent("message", { data: JSON.stringify({ setupComplete: {} }) }),
      );
      await flushMicrotasks();
    });
    await act(async () => {
      mocks.webSocketConnections[0].options.onMessage?.(
        new MessageEvent("message", {
          data: JSON.stringify({
            sessionResumptionUpdate: { resumable: true, newHandle: "resume-handle" },
          }),
        }),
      );
      mocks.webSocketConnections[0].options.onMessage?.(
        new MessageEvent("message", {
          data: JSON.stringify({ goAway: { timeLeft: "10s" } }),
        }),
      );
      await flushMicrotasks();
    });
    act(() => mocks.webSocketConnections[1].options.onOpen?.(new Event("open")));
    await act(async () => {
      mocks.webSocketConnections[1].options.onMessage?.(
        new MessageEvent("message", { data: JSON.stringify({ setupComplete: {} }) }),
      );
      await flushMicrotasks();
    });

    expect(mocks.startJpegFrameStream).toHaveBeenCalledOnce();

    await act(async () => {
      pendingOldAudio.resolve(staleAudioController);
      await flushMicrotasks();
    });

    expect(staleAudioController.stop).toHaveBeenCalledOnce();
    expect(mocks.startJpegFrameStream).toHaveBeenCalledOnce();
    expect(video.stop).not.toHaveBeenCalled();

    await act(async () => {
      pendingReplacementVideo.resolve({ stop: vi.fn() });
      await flushMicrotasks();
    });

    expect(result.current.status).toBe("active");
  });

  it("waits for a fresh Gemini resumption handle after GoAway", async () => {
    mocks.createRealtimeSession.mockResolvedValue(googleSession());
    const providers = [googleProvider()];
    const { result } = renderHook(() => useRealtimeLiveSession({ providers }));

    await act(async () => result.current.start("google-ai-studio"));
    act(() => mocks.webSocketConnections[0].options.onOpen?.(new Event("open")));
    await act(async () => {
      for (const sessionResumptionUpdate of [
        { resumable: true, newHandle: "stale-handle" },
        { resumable: false },
      ]) {
        mocks.webSocketConnections[0].options.onMessage?.(
          new MessageEvent("message", {
            data: JSON.stringify({ sessionResumptionUpdate }),
          }),
        );
      }

      mocks.webSocketConnections[0].options.onMessage?.(
        new MessageEvent("message", {
          data: JSON.stringify({ goAway: { timeLeft: "10s" } }),
        }),
      );
      await flushMicrotasks();
    });

    expect(mocks.webSocketConnections).toHaveLength(1);
    expect(mocks.webSocketConnections[0].close).not.toHaveBeenCalled();

    await act(async () => {
      mocks.webSocketConnections[0].options.onMessage?.(
        new MessageEvent("message", {
          data: JSON.stringify({
            sessionResumptionUpdate: { resumable: true, newHandle: "fresh-handle" },
          }),
        }),
      );
      await flushMicrotasks();
    });

    expect(mocks.webSocketConnections).toHaveLength(2);
    expect(mocks.webSocketConnections[0].close).toHaveBeenCalledOnce();
    act(() => mocks.webSocketConnections[1].options.onOpen?.(new Event("open")));
    expect(mocks.webSocketConnections[1].sendJson).toHaveBeenCalledWith({
      setup: expect.objectContaining({
        sessionResumption: { handle: "fresh-handle" },
      }),
    });
  });

  it("releases media and closes the socket when the active provider leaves the catalogue", async () => {
    const audio = fakeAudioStream();

    mocks.requestAudioStream.mockResolvedValue(audio.stream);
    mocks.createRealtimeSession.mockResolvedValue({
      provider: "mistral",
      transport: "websocket",
      url: "wss://api.polychat.test/realtime",
    });
    const initialProviders = [provider("mistral", "websocket")];
    const { result, rerender } = renderHook(
      ({ providers }) => useRealtimeLiveSession({ providers }),
      { initialProps: { providers: initialProviders } },
    );

    await act(async () => result.current.start("mistral"));
    await act(async () => {
      mocks.webSocketConnections[0].options.onOpen?.(new Event("open"));
      await flushMicrotasks();
    });
    rerender({ providers: [] });

    expect(() => act(() => result.current.setMicrophoneEnabled(false))).not.toThrow();
    expect(audio.stop).toHaveBeenCalled();
    expect(() => act(() => result.current.stop())).not.toThrow();
    expect(mocks.webSocketConnections[0].close).toHaveBeenCalledOnce();
  });

  it("closes transport and media when unmounted", async () => {
    const audio = fakeAudioStream();

    mocks.requestAudioStream.mockResolvedValue(audio.stream);
    mocks.createRealtimeSession.mockResolvedValue({
      provider: "openai",
      transport: "webrtc",
    });
    const providers = [provider("openai", "webrtc")];
    const { result, unmount } = renderHook(() => useRealtimeLiveSession({ providers }));

    await act(async () => result.current.start("openai"));
    unmount();

    expect(audio.stop).toHaveBeenCalled();
    expect(mocks.webRtcConnections[0].close).toHaveBeenCalledOnce();
  });
});
