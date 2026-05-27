import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useRealtimeLiveSession } from "../useRealtimeLiveSession";

const mocks = vi.hoisted(() => ({
	arrayBufferToBase64: vi.fn(() => "audio-base64"),
	connectGeminiLiveWebSocket: vi.fn(),
	connectOpenAIRealtimeWebRTC: vi.fn(),
	connectRealtimeWebSocket: vi.fn(),
	createPcm16AudioPlayer: vi.fn(() => ({ playBase64: vi.fn(), stop: vi.fn() })),
	createRealtimeSession: vi.fn(),
	preferOpusAudioCodec: vi.fn(),
	startJpegFrameStream: vi.fn(),
	startPcm16MicrophoneStream: vi.fn(),
	toastError: vi.fn(),
}));

vi.mock("~/lib/api/realtime-service", () => ({
	createRealtimeSession: mocks.createRealtimeSession,
}));

vi.mock("~/lib/realtime", () => ({
	connectGeminiLiveWebSocket: mocks.connectGeminiLiveWebSocket,
	connectOpenAIRealtimeWebRTC: mocks.connectOpenAIRealtimeWebRTC,
	connectRealtimeWebSocket: mocks.connectRealtimeWebSocket,
	preferOpusAudioCodec: mocks.preferOpusAudioCodec,
}));

vi.mock("~/lib/realtime/audio", () => ({
	arrayBufferToBase64: mocks.arrayBufferToBase64,
	createPcm16AudioPlayer: mocks.createPcm16AudioPlayer,
	startJpegFrameStream: mocks.startJpegFrameStream,
	startPcm16MicrophoneStream: mocks.startPcm16MicrophoneStream,
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
		provider: "google-ai-studio" | "mistral";
		protocol?: string;
		setup?: Record<string, unknown>;
		transport: "websocket";
		url: string;
	};
	socket: {
		readyState: number;
	};
}

const geminiSetup = {
	model: "models/gemini-3.1-flash-live-preview",
	generationConfig: {
		responseModalities: ["AUDIO"],
	},
};

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

function createCloseEvent(init: Pick<CloseEvent, "code" | "reason" | "wasClean">): CloseEvent {
	return init as CloseEvent;
}

describe("useRealtimeLiveSession", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.stubGlobal(
			"WebSocket",
			class FakeWebSocket {
				static CLOSED = 3;
				static OPEN = 1;
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

		mocks.createRealtimeSession.mockResolvedValue({
			provider: "mistral",
			transport: "websocket",
			url: "wss://example.test/mistral",
		});
		mocks.startPcm16MicrophoneStream.mockResolvedValue({ stop: vi.fn() });
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

	it("waits for Gemini setup completion before starting microphone streams", async () => {
		const connection = createGeminiConnection();
		mocks.createRealtimeSession.mockResolvedValueOnce(connection.session);
		mocks.connectGeminiLiveWebSocket.mockReturnValueOnce(connection);
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

		const connectOptions = mocks.connectGeminiLiveWebSocket.mock.calls[0][0];
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

	it("starts Gemini video only when video input is enabled", async () => {
		const connection = createGeminiConnection();
		mocks.createRealtimeSession.mockResolvedValueOnce(connection.session);
		mocks.connectGeminiLiveWebSocket.mockReturnValueOnce(connection);
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

		const connectOptions = mocks.connectGeminiLiveWebSocket.mock.calls[0][0];
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
});
