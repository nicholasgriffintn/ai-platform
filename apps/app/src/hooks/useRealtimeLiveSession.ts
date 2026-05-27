import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { createRealtimeSession } from "~/lib/api/realtime-service";
import { getErrorMessage } from "~/lib/errors";
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
	isGeminiSetupCompleteMessage,
	parseRealtimeJsonMessage,
} from "~/lib/realtime/messages";
import { formatRealtimeWebSocketCloseError } from "~/lib/realtime/errors";
import {
	getRealtimeLiveProviderOption,
	type RealtimeLiveProviderId,
} from "~/lib/realtime/live-providers";

export type RealtimeLiveStatus = "idle" | "connecting" | "active" | "error";

interface UseRealtimeLiveSessionOptions {
	model?: string | null;
	onTranscript?: (text: string) => void;
}

const AUDIO_CONSTRAINTS: MediaTrackConstraints = {
	autoGainControl: true,
	echoCancellation: true,
	noiseSuppression: true,
};

const VIDEO_CONSTRAINTS: MediaTrackConstraints = {
	frameRate: { ideal: 1, max: 2 },
	height: { ideal: 360 },
	width: { ideal: 640 },
};

function stopStream(stream?: MediaStream | null): void {
	stream?.getTracks().forEach((track) => track.stop());
}

function setStreamTrackEnabled(
	stream: MediaStream | null | undefined,
	kind: MediaStreamTrack["kind"],
	enabled: boolean,
): void {
	stream
		?.getTracks()
		.filter((track) => track.kind === kind)
		.forEach((track) => {
			track.enabled = enabled;
		});
}

function requestAudioStream(): Promise<MediaStream> {
	return navigator.mediaDevices.getUserMedia({ audio: AUDIO_CONSTRAINTS });
}

function requestVideoStream(): Promise<MediaStream> {
	return navigator.mediaDevices.getUserMedia({ video: VIDEO_CONSTRAINTS });
}

function sendJsonWhenOpen(connection: RealtimeWebSocketConnection, payload: unknown): void {
	if (connection.socket.readyState === WebSocket.OPEN) {
		connection.sendJson(payload);
	}
}

function sendGeminiSetup(connection: RealtimeWebSocketConnection): void {
	const { setup } = connection.session;
	if (!setup) {
		throw new Error("Gemini Live session setup missing");
	}

	connection.sendJson({ setup });
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
	const audioStreamRef = useRef<MediaStream | null>(null);
	const videoStreamRef = useRef<MediaStream | null>(null);
	const microphoneEnabledRef = useRef(true);
	const videoEnabledRef = useRef(false);
	const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
	const statusRef = useRef(status);
	const stoppingRef = useRef(false);
	const [isMicrophoneEnabled, setIsMicrophoneEnabledState] = useState(true);
	const [isVideoEnabled, setIsVideoEnabledState] = useState(false);

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

	const ensureAudioStream = useCallback(async (): Promise<MediaStream> => {
		if (audioStreamRef.current) {
			return audioStreamRef.current;
		}

		const stream = await requestAudioStream();
		setStreamTrackEnabled(stream, "audio", microphoneEnabledRef.current);
		audioStreamRef.current = stream;
		return stream;
	}, []);

	const ensureVideoStream = useCallback(async (): Promise<MediaStream> => {
		if (videoStreamRef.current) {
			return videoStreamRef.current;
		}

		const stream = await requestVideoStream();
		videoStreamRef.current = stream;
		return stream;
	}, []);

	const stopInputAudio = useCallback((notifyProvider = false) => {
		inputAudioControllerRef.current?.stop();
		inputAudioControllerRef.current = null;

		const connection = connectionRef.current;
		if (notifyProvider && connection?.session.provider === "google-ai-studio") {
			sendJsonWhenOpen(connection as RealtimeWebSocketConnection, {
				realtimeInput: { audioStreamEnd: true },
			});
		}

		if (connection?.session.provider === "openai") {
			setStreamTrackEnabled(audioStreamRef.current, "audio", false);
			return;
		}

		stopStream(audioStreamRef.current);
		audioStreamRef.current = null;
	}, []);

	const stopInputVideo = useCallback(() => {
		inputVideoControllerRef.current?.stop();
		inputVideoControllerRef.current = null;
		stopStream(videoStreamRef.current);
		videoStreamRef.current = null;
	}, []);

	const startInputAudio = useCallback(
		async (connection: RealtimeWebSocketConnection) => {
			if (inputAudioControllerRef.current || !microphoneEnabledRef.current) {
				return;
			}

			const stream = await ensureAudioStream();
			if (connection.session.provider === "google-ai-studio") {
				const controller = await startPcm16MicrophoneStream({
					stream,
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
				if (
					connectionRef.current !== connection ||
					stoppingRef.current ||
					!microphoneEnabledRef.current
				) {
					controller.stop();
					return;
				}
				inputAudioControllerRef.current = controller;
				return;
			}

			if (connection.session.provider === "mistral") {
				const controller = await startPcm16MicrophoneStream({
					stream,
					onChunk: (chunk) =>
						sendJsonWhenOpen(connection, {
							type: "input_audio.append",
							audio: arrayBufferToBase64(chunk),
						}),
				});
				if (
					connectionRef.current !== connection ||
					stoppingRef.current ||
					!microphoneEnabledRef.current
				) {
					controller.stop();
					return;
				}
				inputAudioControllerRef.current = controller;
			}
		},
		[ensureAudioStream],
	);

	const startInputVideo = useCallback(
		async (connection: RealtimeWebSocketConnection) => {
			if (
				inputVideoControllerRef.current ||
				!videoEnabledRef.current ||
				connection.session.provider !== "google-ai-studio"
			) {
				return;
			}

			const stream = await ensureVideoStream();
			const controller = await startJpegFrameStream({
				stream,
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
			if (connectionRef.current !== connection || stoppingRef.current || !videoEnabledRef.current) {
				controller.stop();
				return;
			}
			inputVideoControllerRef.current = controller;
		},
		[ensureVideoStream],
	);

	const cleanup = useCallback(
		(nextStatus: RealtimeLiveStatus = "idle", updateState = true) => {
			stoppingRef.current = true;
			abortControllerRef.current?.abort();
			abortControllerRef.current = null;

			stopInputAudio();
			stopInputVideo();
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

			stopStream(audioStreamRef.current);
			audioStreamRef.current = null;
			stopStream(videoStreamRef.current);
			videoStreamRef.current = null;

			if (updateState) {
				setLiveStatus(nextStatus);
				if (nextStatus === "idle") {
					setLastEvent("Idle");
				}
			}
			stoppingRef.current = false;
		},
		[setLiveStatus, stopInputAudio, stopInputVideo],
	);

	const failSession = useCallback(
		(message: string) => {
			if (stoppingRef.current) {
				return;
			}

			setError(message);
			setLastEvent("Connection failed");
			toast.error(message);
			cleanup("error");
		},
		[cleanup],
	);

	const startOpenAI = useCallback(
		async (signal: AbortSignal, selectedModel?: string | null) => {
			const audioStream = await ensureAudioStream();

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
				stream: audioStream,
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
		[ensureAudioStream, handleTranscript, setLiveStatus],
	);

	const startGemini = useCallback(
		async (signal: AbortSignal, selectedModel?: string | null) => {
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
			let hasStartedMedia = false;
			const startGeminiMedia = async () => {
				if (hasStartedMedia) {
					return;
				}
				hasStartedMedia = true;

				try {
					setLastEvent("Starting Gemini Live media");
					await startInputAudio(connection);
					await startInputVideo(connection);

					setLastEvent("Gemini Live connected");
					setLiveStatus("active");
				} catch (openError) {
					if (connectionRef.current === connection && !stoppingRef.current) {
						failSession(getErrorMessage(openError, "Failed to start Gemini Live media"));
					}
				}
			};
			connection = connectGeminiLiveWebSocket({
				session,
				onClose: (event) => {
					if (connectionRef.current === connection && !stoppingRef.current) {
						failSession(formatRealtimeWebSocketCloseError("Gemini Live", event));
					}
				},
				onError: () => {
					if (connectionRef.current === connection && !stoppingRef.current) {
						failSession("Gemini Live connection failed");
					}
				},
				onMessage: (event) => {
					const payload = parseRealtimeJsonMessage(event.data);
					if (isGeminiSetupCompleteMessage(payload)) {
						void startGeminiMedia();
					}
					handleTranscript(payload);
					for (const chunk of extractGeminiAudioChunks(payload)) {
						audioPlayerRef.current?.playBase64(chunk);
					}
				},
				onOpen: () => {
					try {
						sendGeminiSetup(connection);
						setLastEvent("Waiting for Gemini Live setup");
					} catch (openError) {
						if (connectionRef.current === connection && !stoppingRef.current) {
							failSession(getErrorMessage(openError, "Failed to start Gemini Live media"));
						}
					}
				},
			});
			connectionRef.current = connection;
		},
		[failSession, handleTranscript, setLiveStatus, startInputAudio, startInputVideo],
	);

	const startMistral = useCallback(
		async (signal: AbortSignal, selectedModel?: string | null) => {
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
				onClose: (event) => {
					if (connectionRef.current === connection && !stoppingRef.current) {
						failSession(formatRealtimeWebSocketCloseError("Mistral realtime transcription", event));
					}
				},
				onError: () => {
					if (connectionRef.current === connection && !stoppingRef.current) {
						failSession("Mistral realtime transcription failed");
					}
				},
				onMessage: (event) => {
					handleTranscript(parseRealtimeJsonMessage(event.data));
				},
				onOpen: () => {
					void (async () => {
						try {
							setLastEvent("Starting Mistral microphone");
							await startInputAudio(connection);

							setLastEvent("Mistral realtime transcription connected");
							setLiveStatus("active");
						} catch (openError) {
							if (connectionRef.current === connection && !stoppingRef.current) {
								failSession(
									getErrorMessage(
										openError,
										"Failed to start Mistral realtime transcription media",
									),
								);
							}
						}
					})();
				},
			});
			connectionRef.current = connection;
		},
		[failSession, handleTranscript, setLiveStatus, startInputAudio],
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

				failSession(getErrorMessage(startError, "Failed to start live session"));
			}
		},
		[cleanup, failSession, model, provider, startGemini, startMistral, startOpenAI],
	);

	const stop = useCallback(() => {
		cleanup("idle");
	}, [cleanup]);

	const setMicrophoneEnabled = useCallback(
		(enabled: boolean) => {
			microphoneEnabledRef.current = enabled;
			setIsMicrophoneEnabledState(enabled);

			const connection = connectionRef.current;
			if (!connection) {
				return;
			}

			if (connection.session.provider === "openai") {
				setStreamTrackEnabled(audioStreamRef.current, "audio", enabled);
				return;
			}

			if (!enabled) {
				stopInputAudio(true);
				return;
			}

			void startInputAudio(connection as RealtimeWebSocketConnection).catch((toggleError) => {
				failSession(getErrorMessage(toggleError, "Failed to start microphone input"));
			});
		},
		[failSession, startInputAudio, stopInputAudio],
	);

	const setVideoEnabled = useCallback(
		(enabled: boolean) => {
			const nextEnabled = provider === "google-ai-studio" && enabled;
			videoEnabledRef.current = nextEnabled;
			setIsVideoEnabledState(nextEnabled);

			if (!nextEnabled) {
				stopInputVideo();
				return;
			}

			const connection = connectionRef.current;
			if (connection?.session.provider !== "google-ai-studio") {
				return;
			}

			void startInputVideo(connection as RealtimeWebSocketConnection).catch((toggleError) => {
				failSession(getErrorMessage(toggleError, "Failed to start video input"));
			});
		},
		[failSession, provider, startInputVideo, stopInputVideo],
	);

	const changeProvider = useCallback(
		(nextProvider: RealtimeLiveProviderId) => {
			if (statusRef.current === "active" || statusRef.current === "connecting") {
				return;
			}
			setProvider(nextProvider);
			setVideoEnabled(false);
			setLastTranscript(null);
			setLastEvent("Idle");
			setError(null);
		},
		[setVideoEnabled],
	);

	useEffect(() => () => cleanup("idle", false), [cleanup]);

	return {
		error,
		isActive: status === "active",
		isConnecting: status === "connecting",
		isMicrophoneEnabled,
		isVideoEnabled,
		lastEvent,
		lastTranscript,
		provider,
		setMicrophoneEnabled,
		setProvider: changeProvider,
		setVideoEnabled,
		start,
		status,
		stop,
	};
}
