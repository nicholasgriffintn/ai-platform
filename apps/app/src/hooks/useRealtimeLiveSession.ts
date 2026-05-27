import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { createRealtimeSession } from "~/lib/api/realtime-service";
import {
	connectGeminiLiveWebSocket,
	connectOpenAIRealtimeWebRTC,
	connectRealtimeWebSocket,
	preferOpusAudioCodec,
	type RealtimeConnection,
	type RealtimeWebSocketConnection,
} from "~/lib/realtime";
import {
	arrayBufferToBase64,
	createPcm16AudioPlayer,
	startJpegFrameStream,
	startPcm16MicrophoneStream,
	type Pcm16AudioPlayer,
	type RealtimeMediaController,
} from "~/lib/realtime/audio";
import {
	extractGeminiAudioChunks,
	extractRealtimeTranscript,
	parseRealtimeJsonMessage,
} from "~/lib/realtime/messages";
import {
	getRealtimeLiveProviderOption,
	type RealtimeLiveProviderId,
} from "~/lib/realtime/live-providers";

export type RealtimeLiveStatus = "idle" | "connecting" | "active" | "error";

interface UseRealtimeLiveSessionOptions {
	model?: string | null;
	onTranscript?: (text: string) => void;
}

interface MediaStreams {
	audio: MediaStream;
	video?: MediaStream;
}

function stopStream(stream?: MediaStream | null): void {
	stream?.getTracks().forEach((track) => track.stop());
}

function requestMediaStreams(provider: RealtimeLiveProviderId): Promise<MediaStreams> {
	if (provider === "google-ai-studio") {
		return navigator.mediaDevices
			.getUserMedia({
				audio: {
					autoGainControl: true,
					echoCancellation: true,
					noiseSuppression: true,
				},
				video: {
					frameRate: { ideal: 1, max: 2 },
					height: { ideal: 360 },
					width: { ideal: 640 },
				},
			})
			.then((stream) => ({ audio: stream, video: stream }));
	}

	return navigator.mediaDevices
		.getUserMedia({
			audio: {
				autoGainControl: true,
				echoCancellation: true,
				noiseSuppression: true,
			},
		})
		.then((stream) => ({ audio: stream }));
}

function sendJsonWhenOpen(connection: RealtimeWebSocketConnection, payload: unknown): void {
	if (connection.socket.readyState === WebSocket.OPEN) {
		connection.sendJson(payload);
	}
}

export function useRealtimeLiveSession({
	model,
	onTranscript,
}: UseRealtimeLiveSessionOptions = {}) {
	const [provider, setProvider] = useState<RealtimeLiveProviderId>("openai");
	const [status, setStatus] = useState<RealtimeLiveStatus>("idle");
	const [error, setError] = useState<string | null>(null);
	const [lastEvent, setLastEvent] = useState("Idle");
	const [lastTranscript, setLastTranscript] = useState<string | null>(null);

	const abortControllerRef = useRef<AbortController | null>(null);
	const audioPlayerRef = useRef<Pcm16AudioPlayer | null>(null);
	const connectionRef = useRef<RealtimeConnection | null>(null);
	const inputAudioControllerRef = useRef<RealtimeMediaController | null>(null);
	const inputVideoControllerRef = useRef<RealtimeMediaController | null>(null);
	const mediaStreamRef = useRef<MediaStream | null>(null);
	const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
	const statusRef = useRef(status);
	const stoppingRef = useRef(false);

	const setLiveStatus = useCallback((nextStatus: RealtimeLiveStatus) => {
		statusRef.current = nextStatus;
		setStatus(nextStatus);
	}, []);

	const handleTranscript = useCallback(
		(payload: unknown) => {
			const transcript = extractRealtimeTranscript(payload);
			if (!transcript) {
				return;
			}

			setLastTranscript(transcript.text);
			setLastEvent(transcript.source === "output" ? "Assistant transcript" : "Input transcript");
			if (transcript.isFinal && transcript.source !== "output") {
				onTranscript?.(transcript.text);
			}
		},
		[onTranscript],
	);

	const cleanup = useCallback(
		(nextStatus: RealtimeLiveStatus = "idle", updateState = true) => {
			stoppingRef.current = true;
			abortControllerRef.current?.abort();
			abortControllerRef.current = null;

			inputAudioControllerRef.current?.stop();
			inputAudioControllerRef.current = null;
			inputVideoControllerRef.current?.stop();
			inputVideoControllerRef.current = null;
			audioPlayerRef.current?.stop();
			audioPlayerRef.current = null;

			if (connectionRef.current?.session.provider === "mistral") {
				const connection = connectionRef.current as RealtimeWebSocketConnection;
				sendJsonWhenOpen(connection, { type: "input_audio.end" });
			}
			if (connectionRef.current?.session.provider === "google-ai-studio") {
				const connection = connectionRef.current as RealtimeWebSocketConnection;
				sendJsonWhenOpen(connection, { realtimeInput: { audioStreamEnd: true } });
			}

			connectionRef.current?.close();
			connectionRef.current = null;

			remoteAudioRef.current?.pause();
			remoteAudioRef.current?.removeAttribute("src");
			remoteAudioRef.current?.load();
			remoteAudioRef.current = null;

			stopStream(mediaStreamRef.current);
			mediaStreamRef.current = null;

			if (updateState) {
				setLiveStatus(nextStatus);
				if (nextStatus === "idle") {
					setLastEvent("Idle");
				}
			}
			stoppingRef.current = false;
		},
		[setLiveStatus],
	);

	const startOpenAI = useCallback(
		async (signal: AbortSignal, selectedModel?: string | null) => {
			const streams = await requestMediaStreams("openai");
			mediaStreamRef.current = streams.audio;

			const session = await createRealtimeSession({
				type: "realtime",
				provider: "openai",
				model: selectedModel ?? undefined,
				transport: "webrtc",
				inputModalities: ["audio"],
				outputModalities: ["audio"],
				signal,
			});

			const remoteAudio = new Audio();
			remoteAudio.autoplay = true;
			remoteAudioRef.current = remoteAudio;

			const connection = await connectOpenAIRealtimeWebRTC({
				session,
				stream: streams.audio,
				signal,
				configurePeerConnection: preferOpusAudioCodec,
				onDataChannelMessage: (event) => {
					handleTranscript(parseRealtimeJsonMessage(event.data));
				},
				onTrack: (event) => {
					remoteAudio.srcObject = event.streams[0] ?? new MediaStream([event.track]);
					void remoteAudio.play().catch(() => {
						setLastEvent("Tap Live again if the browser blocked playback");
					});
				},
			});

			connectionRef.current = connection;
			setLastEvent("OpenAI Realtime connected");
			setLiveStatus("active");
		},
		[handleTranscript, setLiveStatus],
	);

	const startGemini = useCallback(
		async (signal: AbortSignal, selectedModel?: string | null) => {
			const streams = await requestMediaStreams("google-ai-studio");
			mediaStreamRef.current = streams.audio;

			const session = await createRealtimeSession({
				type: "realtime",
				provider: "google-ai-studio",
				model: selectedModel ?? undefined,
				transport: "websocket",
				inputModalities: ["audio", "video"],
				outputModalities: ["audio"],
				signal,
			});

			audioPlayerRef.current = createPcm16AudioPlayer({ sampleRate: 24000 });

			let connection: RealtimeWebSocketConnection;
			connection = connectGeminiLiveWebSocket({
				session,
				onClose: () => {
					if (connectionRef.current === connection && !stoppingRef.current) {
						cleanup("idle");
					}
				},
				onError: () => {
					if (connectionRef.current === connection && !stoppingRef.current) {
						setError("Gemini Live connection failed");
						setLiveStatus("error");
					}
				},
				onMessage: (event) => {
					const payload = parseRealtimeJsonMessage(event.data);
					handleTranscript(payload);
					for (const chunk of extractGeminiAudioChunks(payload)) {
						audioPlayerRef.current?.playBase64(chunk);
					}
				},
				onOpen: async () => {
					setLastEvent("Gemini Live connected");
					setLiveStatus("active");
					inputAudioControllerRef.current = await startPcm16MicrophoneStream({
						stream: streams.audio,
						onChunk: (chunk) =>
							sendJsonWhenOpen(connection, {
								realtimeInput: {
									audio: {
										data: arrayBufferToBase64(chunk),
										mimeType: "audio/pcm;rate=16000",
									},
								},
							}),
					});
					inputVideoControllerRef.current = await startJpegFrameStream({
						stream: streams.video ?? streams.audio,
						onFrame: (frame) =>
							sendJsonWhenOpen(connection, {
								realtimeInput: {
									video: {
										data: frame.data,
										mimeType: frame.mimeType,
									},
								},
							}),
					});
				},
			});
			connectionRef.current = connection;
		},
		[cleanup, handleTranscript, setLiveStatus],
	);

	const startMistral = useCallback(
		async (signal: AbortSignal, selectedModel?: string | null) => {
			const streams = await requestMediaStreams("mistral");
			mediaStreamRef.current = streams.audio;

			const session = await createRealtimeSession({
				type: "transcription",
				provider: "mistral",
				model: selectedModel ?? undefined,
				transport: "websocket",
				delay: "low",
				signal,
			});

			let connection: RealtimeWebSocketConnection;
			connection = connectRealtimeWebSocket({
				session,
				onClose: () => {
					if (connectionRef.current === connection && !stoppingRef.current) {
						cleanup("idle");
					}
				},
				onError: () => {
					if (connectionRef.current === connection && !stoppingRef.current) {
						setError("Mistral realtime transcription failed");
						setLiveStatus("error");
					}
				},
				onMessage: (event) => {
					handleTranscript(parseRealtimeJsonMessage(event.data));
				},
				onOpen: async () => {
					setLastEvent("Mistral realtime transcription connected");
					setLiveStatus("active");
					inputAudioControllerRef.current = await startPcm16MicrophoneStream({
						stream: streams.audio,
						onChunk: (chunk) =>
							sendJsonWhenOpen(connection, {
								type: "input_audio.append",
								audio: arrayBufferToBase64(chunk),
							}),
					});
				},
			});
			connectionRef.current = connection;
		},
		[cleanup, handleTranscript, setLiveStatus],
	);

	const start = useCallback(
		async (providerOverride?: RealtimeLiveProviderId, modelOverride?: string | null) => {
			if (statusRef.current === "active" || statusRef.current === "connecting") {
				return;
			}

			cleanup("connecting");
			setError(null);
			setLastTranscript(null);
			setLastEvent("Connecting");

			const abortController = new AbortController();
			abortControllerRef.current = abortController;
			const selectedProvider = getRealtimeLiveProviderOption(providerOverride ?? provider);
			const selectedModel = modelOverride ?? model;

			try {
				if (selectedProvider.id === "openai") {
					await startOpenAI(abortController.signal, selectedModel);
				} else if (selectedProvider.id === "google-ai-studio") {
					await startGemini(abortController.signal, selectedModel);
				} else {
					await startMistral(abortController.signal, selectedModel);
				}
			} catch (startError) {
				if (abortController.signal.aborted) {
					return;
				}

				const message =
					startError instanceof Error ? startError.message : "Failed to start live session";
				setError(message);
				setLastEvent("Connection failed");
				setLiveStatus("error");
				toast.error(message);
				cleanup("error");
			}
		},
		[cleanup, model, provider, setLiveStatus, startGemini, startMistral, startOpenAI],
	);

	const stop = useCallback(() => {
		cleanup("idle");
	}, [cleanup]);

	const changeProvider = useCallback((nextProvider: RealtimeLiveProviderId) => {
		if (statusRef.current === "active" || statusRef.current === "connecting") {
			return;
		}
		setProvider(nextProvider);
		setLastTranscript(null);
		setLastEvent("Idle");
		setError(null);
	}, []);

	useEffect(() => () => cleanup("idle", false), [cleanup]);

	return {
		error,
		isActive: status === "active",
		isConnecting: status === "connecting",
		lastEvent,
		lastTranscript,
		provider,
		setProvider: changeProvider,
		start,
		status,
		stop,
	};
}
