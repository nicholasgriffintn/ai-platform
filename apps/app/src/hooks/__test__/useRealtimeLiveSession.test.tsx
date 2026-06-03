import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useRealtimeLiveSession } from "../useRealtimeLiveSession";

const mocks = vi.hoisted(() => ({
	arrayBufferToBase64: vi.fn(() => "audio-base64"),
	calculatePcm16Base64AudioLevel: vi.fn(() => 0.5),
	calculatePcm16AudioLevel: vi.fn(() => 0.5),
	connectRealtimeWebRTC: vi.fn(),
	connectRealtimeWebSocket: vi.fn(),
	createMediaStreamAudioLevelMeter: vi.fn(() => ({ stop: vi.fn() })),
	createPcm16AudioPlayer: vi.fn(() => ({ playBase64: vi.fn(), stop: vi.fn() })),
	createRealtimeSession: vi.fn(),
	isRealtimeWebSocketConnection: vi.fn((connection) =>
		Boolean(
			connection &&
			connection.session.transport === "websocket" &&
			"socket" in connection &&
			"sendJson" in connection,
		),
	),
	preferOpusAudioCodec: vi.fn(),
	requestRealtimeAudioStream: vi.fn(),
	requestRealtimeVideoStream: vi.fn(),
	sendJsonWhenOpen: vi.fn((connection, payload) => {
		if (connection.socket.readyState === WebSocket.OPEN) {
			connection.sendJson(payload);
		}
	}),
	setMediaStreamTrackEnabled: vi.fn(),
	startJpegFrameStream: vi.fn(),
	startPcm16MicrophoneStream: vi.fn(),
	stopMediaStream: vi.fn(),
	toastError: vi.fn(),
}));

vi.mock("~/lib/api/realtime-service", () => ({
	createRealtimeSession: mocks.createRealtimeSession,
}));

vi.mock("~/lib/realtime", () => ({
	connectRealtimeWebRTC: mocks.connectRealtimeWebRTC,
	connectRealtimeWebSocket: mocks.connectRealtimeWebSocket,
	isRealtimeWebSocketConnection: mocks.isRealtimeWebSocketConnection,
	preferOpusAudioCodec: mocks.preferOpusAudioCodec,
	sendJsonWhenOpen: mocks.sendJsonWhenOpen,
}));

vi.mock("~/lib/realtime/audio", () => ({
	arrayBufferToBase64: mocks.arrayBufferToBase64,
	createPcm16AudioPlayer: mocks.createPcm16AudioPlayer,
	requestRealtimeAudioStream: mocks.requestRealtimeAudioStream,
	requestRealtimeVideoStream: mocks.requestRealtimeVideoStream,
	setMediaStreamTrackEnabled: mocks.setMediaStreamTrackEnabled,
	startJpegFrameStream: mocks.startJpegFrameStream,
	startPcm16MicrophoneStream: mocks.startPcm16MicrophoneStream,
	stopMediaStream: mocks.stopMediaStream,
}));

vi.mock("~/lib/realtime/audio-levels", () => ({
	calculatePcm16Base64AudioLevel: mocks.calculatePcm16Base64AudioLevel,
	calculatePcm16AudioLevel: mocks.calculatePcm16AudioLevel,
	createMediaStreamAudioLevelMeter: mocks.createMediaStreamAudioLevelMeter,
}));

vi.mock("sonner", () => ({
	toast: {
		error: mocks.toastError,
	},
}));

interface MockWebSocketConnection {
	close: ReturnType<typeof vi.fn>;
	sendJson: ReturnType<typeof vi.fn>;
	session: {
		provider: "elevenlabs" | "google-ai-studio" | "mistral";
		protocol?: string;
		setup?: Record<string, unknown>;
		transport: "websocket";
		url: string;
	};
	socket: {
		readyState: number;
	};
}

interface MockWebRTCConnection {
	close: ReturnType<typeof vi.fn>;
	dataChannel: {
		close: ReturnType<typeof vi.fn>;
		readyState: "open";
		send: ReturnType<typeof vi.fn>;
	};
	peerConnection: {
		close: ReturnType<typeof vi.fn>;
	};
	session: {
		client_secret: {
			value: string;
		};
		provider: "openai";
		transport: "webrtc";
		url: string;
	};
}

const geminiSetup = {
	model: "models/gemini-3.1-flash-live-preview",
	generationConfig: {
		responseModalities: ["AUDIO"],
	},
};
let microphoneChunkHandler: ((chunk: ArrayBuffer) => void) | undefined;

function createMistralConnection(): MockWebSocketConnection {
	const socket: MockWebSocketConnection["socket"] = { readyState: WebSocket.OPEN };
	return {
		close: vi.fn(() => {
			socket.readyState = WebSocket.CLOSED;
		}),
		sendJson: vi.fn(),
		session: {
			provider: "mistral",
			transport: "websocket",
			url: "wss://example.test/mistral",
		},
		socket,
	};
}

function createElevenLabsConnection(): MockWebSocketConnection {
	const socket: MockWebSocketConnection["socket"] = { readyState: WebSocket.OPEN };
	return {
		close: vi.fn(() => {
			socket.readyState = WebSocket.CLOSED;
		}),
		sendJson: vi.fn(),
		session: {
			provider: "elevenlabs",
			transport: "websocket",
			url: "wss://example.test/elevenlabs",
		},
		socket,
	};
}

function createGeminiConnection(): MockWebSocketConnection {
	const socket: MockWebSocketConnection["socket"] = { readyState: WebSocket.OPEN };
	return {
		close: vi.fn(() => {
			socket.readyState = WebSocket.CLOSED;
		}),
		sendJson: vi.fn(),
		session: {
			provider: "google-ai-studio",
			protocol: "gemini-live",
			setup: geminiSetup,
			transport: "websocket",
			url: "wss://example.test/gemini",
		},
		socket,
	};
}

function createOpenAIConnection(): MockWebRTCConnection {
	return {
		close: vi.fn(),
		dataChannel: {
			close: vi.fn(),
			readyState: "open",
			send: vi.fn(),
		},
		peerConnection: {
			close: vi.fn(),
		},
		session: {
			provider: "openai",
			transport: "webrtc",
			url: "https://api.openai.com/v1/realtime/calls",
			client_secret: {
				value: "ek_test",
			},
		},
	};
}

function createCloseEvent(init: Pick<CloseEvent, "code" | "reason" | "wasClean">): CloseEvent {
	return init as CloseEvent;
}

function createPcm16TestAudioBuffer(sample: number, length = 6400): ArrayBuffer {
	const buffer = new ArrayBuffer(length * 2);
	const view = new DataView(buffer);
	const int16Sample = Math.round(Math.max(-1, Math.min(1, sample)) * 0x7fff);
	for (let index = 0; index < length; index += 1) {
		view.setInt16(index * 2, int16Sample, true);
	}
	return buffer;
}

describe("useRealtimeLiveSession", () => {
	afterEach(() => {
		vi.useRealTimers();
	});

	beforeEach(() => {
		vi.clearAllMocks();
		mocks.calculatePcm16AudioLevel.mockReturnValue(0.5);
		vi.stubGlobal(
			"WebSocket",
			class FakeWebSocket {
				static CLOSED = 3;
				static OPEN = 1;
			},
		);
		vi.stubGlobal(
			"Audio",
			class FakeAudio {
				autoplay = false;
				srcObject: MediaStream | null = null;
				load = vi.fn();
				pause = vi.fn();
				play = vi.fn().mockResolvedValue(undefined);
				removeAttribute = vi.fn();
			},
		);

		const stream = {
			getTracks: () => [{ stop: vi.fn() }],
		} as unknown as MediaStream;
		Object.defineProperty(navigator, "mediaDevices", {
			configurable: true,
			value: {
				getUserMedia: vi.fn().mockResolvedValue(stream),
			},
		});
		mocks.requestRealtimeAudioStream.mockResolvedValue(stream);
		mocks.requestRealtimeVideoStream.mockResolvedValue(stream);

		mocks.createRealtimeSession.mockResolvedValue({
			provider: "mistral",
			transport: "websocket",
			url: "wss://example.test/mistral",
		});
		microphoneChunkHandler = undefined;
		mocks.startPcm16MicrophoneStream.mockImplementation(({ onChunk }) => {
			microphoneChunkHandler = onChunk;
			return Promise.resolve({ stop: vi.fn() });
		});
		mocks.startJpegFrameStream.mockResolvedValue({ stop: vi.fn() });
		mocks.connectRealtimeWebSocket.mockImplementation(() => createMistralConnection());
	});

	it("reports unexpected Mistral WebSocket closes instead of returning to idle", async () => {
		const { result } = renderHook(() => useRealtimeLiveSession());

		await act(async () => {
			await result.current.start("mistral", "voxtral-mini-transcribe-realtime");
		});

		const connectOptions = mocks.connectRealtimeWebSocket.mock.calls[0][0];
		act(() => {
			connectOptions.onOpen?.(new Event("open"));
		});

		await waitFor(() => expect(result.current.status).toBe("active"));

		act(() => {
			connectOptions.onClose?.(
				createCloseEvent({ code: 1006, reason: "provider closed", wasClean: false }),
			);
		});

		expect(result.current.status).toBe("error");
		expect(result.current.error).toContain("Mistral realtime transcription disconnected");
		expect(result.current.lastEvent).toBe("Connection failed");
	});

	it("surfaces microphone setup failures from WebSocket open handlers", async () => {
		mocks.startPcm16MicrophoneStream.mockRejectedValueOnce(new Error("AudioWorklet module failed"));
		const connection = createMistralConnection();
		mocks.connectRealtimeWebSocket.mockReturnValueOnce(connection);
		const { result } = renderHook(() => useRealtimeLiveSession());

		await act(async () => {
			await result.current.start("mistral", "voxtral-mini-transcribe-realtime");
		});

		const connectOptions = mocks.connectRealtimeWebSocket.mock.calls[0][0];
		act(() => {
			connectOptions.onOpen?.(new Event("open"));
		});

		await waitFor(() => expect(result.current.status).toBe("error"));

		expect(result.current.error).toBe("AudioWorklet module failed");
		expect(result.current.lastEvent).toBe("Connection failed");
		expect(mocks.toastError).toHaveBeenCalledWith("AudioWorklet module failed");
		expect(connection.close).toHaveBeenCalled();
	});

	it("surfaces OpenAI Realtime data channel lifecycle events", async () => {
		const connection = createOpenAIConnection();
		mocks.createRealtimeSession.mockResolvedValueOnce(connection.session);
		mocks.connectRealtimeWebRTC.mockResolvedValueOnce(connection);
		const { result } = renderHook(() => useRealtimeLiveSession());

		await act(async () => {
			await result.current.start("openai", "gpt-realtime-2");
		});

		await waitFor(() => expect(result.current.status).toBe("active"));

		const connectOptions = mocks.connectRealtimeWebRTC.mock.calls[0][0];
		act(() => {
			connectOptions.onDataChannelOpen?.(new Event("open"));
		});

		expect(result.current.lastEvent).toBe("Realtime session listening");

		act(() => {
			connectOptions.onDataChannelMessage?.(
				new MessageEvent("message", {
					data: JSON.stringify({ type: "input_audio_buffer.speech_started" }),
				}),
			);
		});

		expect(result.current.lastEvent).toBe("Listening");

		act(() => {
			connectOptions.onDataChannelMessage?.(
				new MessageEvent("message", {
					data: JSON.stringify({ type: "response.output_audio.delta" }),
				}),
			);
		});

		expect(result.current.lastEvent).toBe("Assistant speaking");
	});

	it("fails OpenAI Realtime sessions when the data channel emits an error", async () => {
		const connection = createOpenAIConnection();
		mocks.createRealtimeSession.mockResolvedValueOnce(connection.session);
		mocks.connectRealtimeWebRTC.mockResolvedValueOnce(connection);
		const { result } = renderHook(() => useRealtimeLiveSession());

		await act(async () => {
			await result.current.start("openai", "gpt-realtime-2");
		});

		await waitFor(() => expect(result.current.status).toBe("active"));

		const connectOptions = mocks.connectRealtimeWebRTC.mock.calls[0][0];
		act(() => {
			connectOptions.onDataChannelMessage?.(
				new MessageEvent("message", {
					data: JSON.stringify({
						type: "error",
						error: {
							message: "Realtime failed",
						},
					}),
				}),
			);
		});

		expect(result.current.status).toBe("error");
		expect(result.current.error).toBe("Realtime failed");
		expect(result.current.lastEvent).toBe("Connection failed");
		expect(mocks.toastError).toHaveBeenCalledWith("Realtime failed");
		expect(connection.close).toHaveBeenCalled();
	});

	it("waits for Gemini setup completion before starting microphone streams", async () => {
		const connection = createGeminiConnection();
		mocks.createRealtimeSession.mockResolvedValueOnce(connection.session);
		mocks.connectRealtimeWebSocket.mockReturnValueOnce(connection);
		const callOrder: string[] = [];
		connection.sendJson.mockImplementation(() => {
			callOrder.push("setup");
		});
		mocks.startPcm16MicrophoneStream.mockImplementationOnce(async () => {
			callOrder.push("microphone");
			return { stop: vi.fn() };
		});
		const { result } = renderHook(() => useRealtimeLiveSession());

		await act(async () => {
			await result.current.start("google-ai-studio", "gemini-3.1-flash-live-preview");
		});

		const connectOptions = mocks.connectRealtimeWebSocket.mock.calls[0][0];
		act(() => {
			connectOptions.onOpen?.(new Event("open"));
		});

		expect(connection.sendJson).toHaveBeenCalledWith({ setup: geminiSetup });
		expect(callOrder).toEqual(["setup"]);
		expect(result.current.status).toBe("connecting");
		expect(result.current.lastEvent).toBe("Waiting for Gemini Live setup");

		act(() => {
			connectOptions.onMessage?.(
				new MessageEvent("message", {
					data: JSON.stringify({ setupComplete: {} }),
				}),
			);
		});

		await waitFor(() => expect(result.current.status).toBe("active"));

		expect(callOrder).toEqual(["setup", "microphone"]);
		expect(mocks.startJpegFrameStream).not.toHaveBeenCalled();
	});

	it("starts Gemini media when setup completion arrives as a binary JSON frame", async () => {
		const connection = createGeminiConnection();
		mocks.createRealtimeSession.mockResolvedValueOnce(connection.session);
		mocks.connectRealtimeWebSocket.mockReturnValueOnce(connection);
		const { result } = renderHook(() => useRealtimeLiveSession());

		await act(async () => {
			await result.current.start("google-ai-studio", "gemini-3.1-flash-live-preview");
		});

		const connectOptions = mocks.connectRealtimeWebSocket.mock.calls[0][0];
		await act(async () => {
			connectOptions.onOpen?.(new Event("open"));
			connectOptions.onMessage?.(
				new MessageEvent("message", {
					data: new Blob([JSON.stringify({ setupComplete: {} })]),
				}),
			);
		});

		await waitFor(() => expect(result.current.status).toBe("active"));

		expect(mocks.startPcm16MicrophoneStream).toHaveBeenCalledTimes(1);
		expect(result.current.lastEvent).toBe("Gemini Live connected");
	});

	it("starts Gemini video only when video input is enabled", async () => {
		const connection = createGeminiConnection();
		mocks.createRealtimeSession.mockResolvedValueOnce(connection.session);
		mocks.connectRealtimeWebSocket.mockReturnValueOnce(connection);
		const callOrder: string[] = [];
		connection.sendJson.mockImplementation(() => {
			callOrder.push("setup");
		});
		mocks.startPcm16MicrophoneStream.mockImplementationOnce(async () => {
			callOrder.push("microphone");
			return { stop: vi.fn() };
		});
		mocks.startJpegFrameStream.mockImplementationOnce(async () => {
			callOrder.push("video");
			return { stop: vi.fn() };
		});
		const { result } = renderHook(() => useRealtimeLiveSession());

		act(() => {
			result.current.setProvider("google-ai-studio");
		});
		await waitFor(() => expect(result.current.provider).toBe("google-ai-studio"));
		act(() => {
			result.current.setVideoEnabled(true);
		});
		await act(async () => {
			await result.current.start("google-ai-studio", "gemini-3.1-flash-live-preview");
		});

		const connectOptions = mocks.connectRealtimeWebSocket.mock.calls[0][0];
		act(() => {
			connectOptions.onOpen?.(new Event("open"));
			connectOptions.onMessage?.(
				new MessageEvent("message", {
					data: JSON.stringify({ setupComplete: {} }),
				}),
			);
		});

		await waitFor(() => expect(result.current.status).toBe("active"));

		expect(result.current.isVideoEnabled).toBe(true);
		expect(callOrder).toEqual(["setup", "microphone", "video"]);
	});

	it("reports Gemini output audio level from streamed audio chunks", async () => {
		const connection = createGeminiConnection();
		mocks.createRealtimeSession.mockResolvedValueOnce(connection.session);
		mocks.connectRealtimeWebSocket.mockReturnValueOnce(connection);
		const { result } = renderHook(() => useRealtimeLiveSession());

		await act(async () => {
			await result.current.start("google-ai-studio", "gemini-3.1-flash-live-preview");
		});

		const connectOptions = mocks.connectRealtimeWebSocket.mock.calls[0][0];
		act(() => {
			connectOptions.onOpen?.(new Event("open"));
			connectOptions.onMessage?.(
				new MessageEvent("message", {
					data: JSON.stringify({ setupComplete: {} }),
				}),
			);
		});

		await waitFor(() => expect(result.current.status).toBe("active"));

		await act(async () => {
			connectOptions.onMessage?.(
				new MessageEvent("message", {
					data: JSON.stringify({
						serverContent: {
							modelTurn: {
								parts: [
									{
										inlineData: {
											data: "output-audio-base64",
											mimeType: "audio/pcm",
										},
									},
								],
							},
						},
					}),
				}),
			);
		});

		const player = mocks.createPcm16AudioPlayer.mock.results[0].value;
		await waitFor(() => expect(player.playBase64).toHaveBeenCalledWith("output-audio-base64"));
		expect(mocks.calculatePcm16Base64AudioLevel).toHaveBeenCalledWith("output-audio-base64");
		expect(result.current.outputAudioLevel).toBe(0.5);
	});

	it("clears queued Gemini output audio when the server reports interruption", async () => {
		const firstPlayer = { playBase64: vi.fn(), stop: vi.fn() };
		const secondPlayer = { playBase64: vi.fn(), stop: vi.fn() };
		mocks.createPcm16AudioPlayer.mockReturnValueOnce(firstPlayer).mockReturnValueOnce(secondPlayer);
		const connection = createGeminiConnection();
		mocks.createRealtimeSession.mockResolvedValueOnce(connection.session);
		mocks.connectRealtimeWebSocket.mockReturnValueOnce(connection);
		const { result } = renderHook(() => useRealtimeLiveSession());

		await act(async () => {
			await result.current.start("google-ai-studio", "gemini-3.1-flash-live-preview");
		});

		const connectOptions = mocks.connectRealtimeWebSocket.mock.calls[0][0];
		act(() => {
			connectOptions.onOpen?.(new Event("open"));
			connectOptions.onMessage?.(
				new MessageEvent("message", {
					data: JSON.stringify({ setupComplete: {} }),
				}),
			);
		});

		await waitFor(() => expect(result.current.status).toBe("active"));

		await act(async () => {
			connectOptions.onMessage?.(
				new MessageEvent("message", {
					data: JSON.stringify({
						serverContent: {
							interrupted: true,
						},
					}),
				}),
			);
		});

		await waitFor(() => expect(firstPlayer.stop).toHaveBeenCalled());
		expect(mocks.createPcm16AudioPlayer).toHaveBeenCalledTimes(2);
	});

	it("can pause and resume WebSocket microphone input without ending the session", async () => {
		const firstController = { stop: vi.fn() };
		const secondController = { stop: vi.fn() };
		mocks.startPcm16MicrophoneStream
			.mockResolvedValueOnce(firstController)
			.mockResolvedValueOnce(secondController);
		const connection = createMistralConnection();
		mocks.connectRealtimeWebSocket.mockReturnValueOnce(connection);
		const { result } = renderHook(() => useRealtimeLiveSession());

		await act(async () => {
			await result.current.start("mistral", "voxtral-mini-transcribe-realtime");
		});

		const connectOptions = mocks.connectRealtimeWebSocket.mock.calls[0][0];
		act(() => {
			connectOptions.onOpen?.(new Event("open"));
		});

		await waitFor(() => expect(result.current.status).toBe("active"));

		act(() => {
			result.current.setMicrophoneEnabled(false);
		});

		expect(result.current.status).toBe("active");
		expect(firstController.stop).toHaveBeenCalled();

		act(() => {
			result.current.setMicrophoneEnabled(true);
		});

		await waitFor(() => expect(mocks.startPcm16MicrophoneStream).toHaveBeenCalledTimes(2));
		expect(secondController.stop).not.toHaveBeenCalled();
	});

	it("flushes Mistral realtime audio before ending transcription on stop", async () => {
		const connection = createMistralConnection();
		mocks.connectRealtimeWebSocket.mockReturnValueOnce(connection);
		const { result } = renderHook(() => useRealtimeLiveSession());

		await act(async () => {
			await result.current.start("mistral", "voxtral-mini-transcribe-realtime");
		});

		const connectOptions = mocks.connectRealtimeWebSocket.mock.calls[0][0];
		act(() => {
			connectOptions.onOpen?.(new Event("open"));
		});

		await waitFor(() => expect(result.current.status).toBe("active"));

		act(() => {
			result.current.stop();
		});

		expect(connection.sendJson).toHaveBeenNthCalledWith(1, { type: "input_audio.flush" });
		expect(connection.sendJson).toHaveBeenNthCalledWith(2, { type: "input_audio.end" });
	});

	it("waits for Mistral transcription done before closing after stop", async () => {
		const connection = createMistralConnection();
		mocks.connectRealtimeWebSocket.mockReturnValueOnce(connection);
		const { result } = renderHook(() => useRealtimeLiveSession());

		await act(async () => {
			await result.current.start("mistral", "voxtral-mini-transcribe-realtime");
		});

		const connectOptions = mocks.connectRealtimeWebSocket.mock.calls[0][0];
		act(() => {
			connectOptions.onOpen?.(new Event("open"));
		});

		await waitFor(() => expect(result.current.status).toBe("active"));

		act(() => {
			result.current.stop();
		});

		expect(connection.close).not.toHaveBeenCalled();
		expect(result.current.status).toBe("idle");

		await act(async () => {
			connectOptions.onMessage?.(
				new MessageEvent("message", {
					data: JSON.stringify({
						type: "transcription.done",
						text: "Final transcript",
						model: "voxtral-mini-transcribe-realtime-2602",
						segments: [],
						usage: {},
						language: "en",
					}),
				}),
			);
		});

		await waitFor(() => expect(connection.close).toHaveBeenCalled());
	});

	it("commits Mistral audio after a speech segment becomes silent", async () => {
		const connection = createMistralConnection();
		mocks.connectRealtimeWebSocket.mockReturnValueOnce(connection);
		const { result } = renderHook(() => useRealtimeLiveSession());

		await act(async () => {
			await result.current.start("mistral", "voxtral-mini-transcribe-realtime");
		});

		const connectOptions = mocks.connectRealtimeWebSocket.mock.calls[0][0];
		await act(async () => {
			connectOptions.onOpen?.(new Event("open"));
		});

		await waitFor(() => expect(result.current.status).toBe("active"));
		expect(microphoneChunkHandler).toEqual(expect.any(Function));
		vi.useFakeTimers();

		mocks.calculatePcm16AudioLevel.mockReturnValue(0.08);
		act(() => {
			microphoneChunkHandler?.(createPcm16TestAudioBuffer(0.08));
		});
		act(() => {
			vi.advanceTimersByTime(220);
			microphoneChunkHandler?.(createPcm16TestAudioBuffer(0.08));
		});
		act(() => {
			vi.advanceTimersByTime(419);
		});
		expect(connection.sendJson).not.toHaveBeenCalledWith({ type: "input_audio.flush" });

		act(() => {
			vi.advanceTimersByTime(1);
		});

		expect(connection.sendJson).toHaveBeenCalledWith({ type: "input_audio.flush" });
		vi.useRealTimers();
	});

	it("does not commit Mistral audio for low-level input", async () => {
		const connection = createMistralConnection();
		mocks.connectRealtimeWebSocket.mockReturnValueOnce(connection);
		const { result } = renderHook(() => useRealtimeLiveSession());

		await act(async () => {
			await result.current.start("mistral", "voxtral-mini-transcribe-realtime");
		});

		const connectOptions = mocks.connectRealtimeWebSocket.mock.calls[0][0];
		await act(async () => {
			connectOptions.onOpen?.(new Event("open"));
		});

		await waitFor(() => expect(result.current.status).toBe("active"));
		vi.useFakeTimers();
		mocks.calculatePcm16AudioLevel.mockReturnValue(0.03);

		act(() => {
			microphoneChunkHandler?.(createPcm16TestAudioBuffer(0.03));
			vi.advanceTimersByTime(1000);
		});

		expect(connection.sendJson).not.toHaveBeenCalledWith({ type: "input_audio.flush" });
		vi.useRealTimers();
	});

	it("waits for ElevenLabs transcription done before closing after stop", async () => {
		const connection = createElevenLabsConnection();
		mocks.createRealtimeSession.mockResolvedValueOnce({
			provider: "elevenlabs",
			transport: "websocket",
			url: "wss://example.test/elevenlabs",
		});
		mocks.connectRealtimeWebSocket.mockReturnValueOnce(connection);
		const { result } = renderHook(() => useRealtimeLiveSession());

		await act(async () => {
			await result.current.start("elevenlabs", "scribe_v2_realtime");
		});

		const connectOptions = mocks.connectRealtimeWebSocket.mock.calls[0][0];
		act(() => {
			connectOptions.onOpen?.(new Event("open"));
		});

		await waitFor(() => expect(result.current.status).toBe("active"));

		act(() => {
			result.current.stop();
		});

		expect(connection.sendJson).toHaveBeenNthCalledWith(1, { type: "input_audio.flush" });
		expect(connection.sendJson).toHaveBeenNthCalledWith(2, { type: "input_audio.end" });
		expect(result.current.status).toBe("idle");
		expect(connection.close).not.toHaveBeenCalled();

		await act(async () => {
			connectOptions.onMessage?.(
				new MessageEvent("message", {
					data: JSON.stringify({
						type: "transcription.done",
						item_id: "elevenlabs-segment-1",
					}),
				}),
			);
		});

		await waitFor(() => expect(connection.close).toHaveBeenCalled());
	});
});
