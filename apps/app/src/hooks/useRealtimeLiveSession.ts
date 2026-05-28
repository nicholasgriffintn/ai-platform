import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { createRealtimeSession } from "~/lib/api/realtime-service";
import { getErrorMessage } from "~/lib/errors";
import {
	connectRealtimeWebRTC,
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
	extractRealtimeErrorMessage,
	extractRealtimeEvent,
	extractRealtimeEventLabel,
	extractRealtimeEventType,
	extractRealtimeTranscript,
	parseRealtimeJsonMessage,
	type RealtimeEventResult,
	type RealtimeTranscriptResult,
} from "~/lib/realtime/messages";
import { formatRealtimeWebSocketCloseError } from "~/lib/realtime/errors";
import {
	DEFAULT_REALTIME_LIVE_PROVIDER_ID,
	getRealtimeLiveProviderOption,
	type RealtimeLiveProviderId,
	type RealtimeLiveProviderOption,
} from "~/lib/realtime/live-providers";

export type RealtimeLiveStatus = "idle" | "connecting" | "active" | "error";

interface UseRealtimeLiveSessionOptions {
	model?: string | null;
	onEvent?: (event: RealtimeEventResult) => void;
	onTranscript?: (transcript: RealtimeTranscriptResult) => void;
}

interface CleanupOptions {
	closeConnection?: boolean;
}

const AUDIO_CONSTRAINTS: MediaTrackConstraints = {
	autoGainControl: false,
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

function isRealtimeWebSocketConnection(
	connection: RealtimeConnection | null,
): connection is RealtimeWebSocketConnection {
	return Boolean(
		connection &&
		connection.session.transport === "websocket" &&
		"socket" in connection &&
		"sendJson" in connection,
	);
}

function getConnectionProviderOption(connection: RealtimeConnection): RealtimeLiveProviderOption {
	return getRealtimeLiveProviderOption(connection.session.provider ?? "");
}

function sendConfiguredAudioEnd(
	connection: RealtimeWebSocketConnection,
	options: { forMicrophonePause?: boolean } = {},
): void {
	const audioInput = getConnectionProviderOption(connection).websocket?.audioInput;
	if (!audioInput || (options.forMicrophonePause && !audioInput.endOnMicrophonePause)) {
		return;
	}

	for (const message of audioInput.endMessages ?? []) {
		sendJsonWhenOpen(connection, message);
	}
}

function shouldWaitForConfiguredAudioEndEvent(connection: RealtimeWebSocketConnection): boolean {
	return Boolean(
		getConnectionProviderOption(connection).websocket?.audioInput?.waitForFinalEventTypeOnStop,
	);
}

function isConfiguredAudioEndEvent(
	connection: RealtimeWebSocketConnection,
	payload: unknown,
): boolean {
	const eventType =
		getConnectionProviderOption(connection).websocket?.audioInput?.waitForFinalEventTypeOnStop;
	return Boolean(eventType && extractRealtimeEventType(payload) === eventType);
}

function providerSupportsVideoInput(provider: string): boolean {
	return Boolean(getRealtimeLiveProviderOption(provider).websocket?.videoInput);
}

export function useRealtimeLiveSession({
	model,
	onEvent,
	onTranscript,
}: UseRealtimeLiveSessionOptions = {}) {
	const [provider, setProvider] = useState<RealtimeLiveProviderId>(
		DEFAULT_REALTIME_LIVE_PROVIDER_ID,
	);
	const [status, setStatus] = useState<RealtimeLiveStatus>("idle");
	const [error, setError] = useState<string | null>(null);
	const [lastEvent, setLastEvent] = useState("Idle");
	const [lastTranscript, setLastTranscript] = useState<string | null>(null);

	const abortControllerRef = useRef<AbortController | null>(null);
	const audioPlayerRef = useRef<Pcm16AudioPlayer | null>(null);
	const connectionRef = useRef<RealtimeConnection | null>(null);
	const inputAudioControllerRef = useRef<RealtimeMediaController | null>(null);
	const inputVideoControllerRef = useRef<RealtimeMediaController | null>(null);
	const finalizingConnectionRef = useRef<RealtimeWebSocketConnection | null>(null);
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
		(payload: unknown): boolean => {
			const transcript = extractRealtimeTranscript(payload);
			if (!transcript) {
				return false;
			}

			setLastTranscript(transcript.text);
			setLastEvent(transcript.source === "output" ? "Assistant transcript" : "Input transcript");
			onTranscript?.(transcript);
			return true;
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
		if (notifyProvider && isRealtimeWebSocketConnection(connection)) {
			sendConfiguredAudioEnd(connection, { forMicrophonePause: true });
		}

		if (connection?.session.transport === "webrtc") {
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

	const completePendingFinalization = useCallback((connection: RealtimeWebSocketConnection) => {
		if (finalizingConnectionRef.current !== connection) {
			return;
		}

		finalizingConnectionRef.current = null;
		if (connectionRef.current === connection) {
			connectionRef.current = null;
		}
		connection.close();
	}, []);

	const startInputAudio = useCallback(
		async (connection: RealtimeWebSocketConnection) => {
			if (inputAudioControllerRef.current || !microphoneEnabledRef.current) {
				return;
			}

			const audioInput = getConnectionProviderOption(connection).websocket?.audioInput;
			if (!audioInput) {
				return;
			}

			const stream = await ensureAudioStream();
			const controller = await startPcm16MicrophoneStream({
				stream,
				onChunk: (chunk) =>
					sendJsonWhenOpen(connection, audioInput.buildAppendMessage(arrayBufferToBase64(chunk))),
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
		},
		[ensureAudioStream],
	);

	const startInputVideo = useCallback(
		async (connection: RealtimeWebSocketConnection) => {
			if (
				inputVideoControllerRef.current ||
				!videoEnabledRef.current ||
				!getConnectionProviderOption(connection).websocket?.videoInput
			) {
				return;
			}

			const videoInput = getConnectionProviderOption(connection).websocket?.videoInput;
			if (!videoInput) {
				return;
			}

			const stream = await ensureVideoStream();
			const controller = await startJpegFrameStream({
				stream,
				onFrame: (frame) => sendJsonWhenOpen(connection, videoInput.buildFrameMessage(frame)),
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
		(nextStatus: RealtimeLiveStatus = "idle", updateState = true, options: CleanupOptions = {}) => {
			const closeConnection = options.closeConnection ?? true;
			stoppingRef.current = true;
			abortControllerRef.current?.abort();
			abortControllerRef.current = null;

			if (closeConnection) {
				finalizingConnectionRef.current = null;
			}

			stopInputAudio();
			stopInputVideo();
			audioPlayerRef.current?.stop();
			audioPlayerRef.current = null;

			if (isRealtimeWebSocketConnection(connectionRef.current)) {
				sendConfiguredAudioEnd(connectionRef.current);
			}

			if (closeConnection) {
				connectionRef.current?.close();
				connectionRef.current = null;
			}

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

	const handleRealtimePayload = useCallback(
		(payload: unknown) => {
			const errorMessage = extractRealtimeErrorMessage(payload);
			if (errorMessage) {
				failSession(errorMessage);
				return;
			}

			if (handleTranscript(payload)) {
				return;
			}

			const event = extractRealtimeEvent(payload);
			const eventLabel = event?.label ?? extractRealtimeEventLabel(payload);
			const eventType = event?.type ?? extractRealtimeEventType(payload);
			if (eventLabel) {
				setLastEvent(eventLabel);
			}
			if (event) {
				onEvent?.(event);
			} else if (eventType) {
				onEvent?.({ label: eventLabel, type: eventType });
			}
		},
		[failSession, handleTranscript, onEvent],
	);

	const startWebRTCProvider = useCallback(
		async (
			selectedProvider: RealtimeLiveProviderOption,
			signal: AbortSignal,
			selectedModel?: string | null,
		) => {
			const audioStream = await ensureAudioStream();

			const session = await createRealtimeSession({
				type: selectedProvider.sessionType,
				provider: selectedProvider.id,
				model: selectedModel ?? undefined,
				transport: selectedProvider.transport,
				inputModalities: selectedProvider.inputModalities,
				outputModalities: selectedProvider.outputModalities,
				signal,
			});

			const remoteAudio = new Audio();
			remoteAudio.autoplay = true;
			remoteAudioRef.current = remoteAudio;

			const connection = await connectRealtimeWebRTC({
				session,
				stream: audioStream,
				signal,
				configurePeerConnection: preferOpusAudioCodec,
				onDataChannelClose: () => {
					if (statusRef.current === "active" && !stoppingRef.current) {
						failSession("Realtime data channel closed");
					}
				},
				onDataChannelError: () => {
					if (!stoppingRef.current) {
						failSession("Realtime data channel failed");
					}
				},
				onDataChannelMessage: (event) => {
					handleRealtimePayload(parseRealtimeJsonMessage(event.data));
				},
				onDataChannelOpen: () => {
					setLastEvent("Realtime session listening");
				},
				onTrack: (event) => {
					remoteAudio.srcObject = event.streams[0] ?? new MediaStream([event.track]);
					void remoteAudio.play().catch(() => {
						setLastEvent("Tap Live again if the browser blocked playback");
					});
				},
			});

			connectionRef.current = connection;
			setLastEvent("Realtime session listening");
			setLiveStatus("active");
		},
		[ensureAudioStream, failSession, handleRealtimePayload, setLiveStatus],
	);

	const startWebSocketProvider = useCallback(
		async (
			selectedProvider: RealtimeLiveProviderOption,
			signal: AbortSignal,
			selectedModel?: string | null,
		) => {
			const websocketConfig = selectedProvider.websocket;
			if (!websocketConfig) {
				throw new Error(`${selectedProvider.label} WebSocket configuration missing`);
			}

			const session = await createRealtimeSession({
				type: selectedProvider.sessionType,
				provider: selectedProvider.id,
				model: selectedModel ?? undefined,
				transport: selectedProvider.transport,
				inputModalities: selectedProvider.inputModalities,
				outputModalities: selectedProvider.outputModalities,
				delay: selectedProvider.defaultDelay,
				signal,
			});

			if (websocketConfig.audioOutput) {
				audioPlayerRef.current = createPcm16AudioPlayer({
					sampleRate: websocketConfig.audioOutput.sampleRate,
				});
			}

			let connection: RealtimeWebSocketConnection;
			let hasStartedMedia = false;
			const startWebSocketMedia = async () => {
				if (hasStartedMedia) {
					return;
				}
				hasStartedMedia = true;

				try {
					setLastEvent(
						websocketConfig.setup?.startingMediaEventLabel ??
							websocketConfig.startingMediaEventLabel,
					);
					await startInputAudio(connection);
					await startInputVideo(connection);

					setLastEvent(
						websocketConfig.setup?.connectedEventLabel ?? websocketConfig.connectedEventLabel,
					);
					setLiveStatus("active");
				} catch (openError) {
					if (connectionRef.current === connection && !stoppingRef.current) {
						failSession(getErrorMessage(openError, websocketConfig.mediaStartFailedMessage));
					}
				}
			};

			connection = connectRealtimeWebSocket({
				session,
				onClose: (event) => {
					if (finalizingConnectionRef.current === connection) {
						finalizingConnectionRef.current = null;
						if (connectionRef.current === connection) {
							connectionRef.current = null;
						}
						return;
					}
					if (connectionRef.current === connection && !stoppingRef.current) {
						failSession(formatRealtimeWebSocketCloseError(websocketConfig.closeErrorLabel, event));
					}
				},
				onError: () => {
					if (finalizingConnectionRef.current === connection) {
						return;
					}
					if (connectionRef.current === connection && !stoppingRef.current) {
						failSession(websocketConfig.connectionFailedMessage);
					}
				},
				onMessage: (event) => {
					const payload = parseRealtimeJsonMessage(event.data);
					if (websocketConfig.setup?.isCompleteMessage(payload)) {
						void startWebSocketMedia();
					}
					handleRealtimePayload(payload);
					for (const chunk of websocketConfig.audioOutput?.extractChunks(payload) ?? []) {
						audioPlayerRef.current?.playBase64(chunk);
					}
					if (isConfiguredAudioEndEvent(connection, payload)) {
						completePendingFinalization(connection);
					}
				},
				onOpen: () => {
					try {
						if (websocketConfig.setup) {
							connection.sendJson(websocketConfig.setup.buildMessage(session));
							setLastEvent(websocketConfig.setup.waitingEventLabel);
							return;
						}

						void startWebSocketMedia();
					} catch (openError) {
						if (connectionRef.current === connection && !stoppingRef.current) {
							failSession(getErrorMessage(openError, websocketConfig.mediaStartFailedMessage));
						}
					}
				},
			});
			connectionRef.current = connection;
		},
		[
			completePendingFinalization,
			failSession,
			handleRealtimePayload,
			setLiveStatus,
			startInputAudio,
			startInputVideo,
		],
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
				if (selectedProvider.transport === "webrtc") {
					await startWebRTCProvider(selectedProvider, abortController.signal, selectedModel);
				} else {
					await startWebSocketProvider(selectedProvider, abortController.signal, selectedModel);
				}
			} catch (startError) {
				if (abortController.signal.aborted) {
					return;
				}

				failSession(getErrorMessage(startError, "Failed to start live session"));
			}
		},
		[cleanup, failSession, model, provider, startWebRTCProvider, startWebSocketProvider],
	);

	const stop = useCallback(() => {
		const connection = connectionRef.current;
		if (
			isRealtimeWebSocketConnection(connection) &&
			shouldWaitForConfiguredAudioEndEvent(connection)
		) {
			finalizingConnectionRef.current = connection;
			cleanup("idle", true, { closeConnection: false });
			return;
		}

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

			if (connection.session.transport === "webrtc") {
				setStreamTrackEnabled(audioStreamRef.current, "audio", enabled);
				return;
			}

			if (!enabled) {
				stopInputAudio(true);
				return;
			}

			if (!isRealtimeWebSocketConnection(connection)) {
				return;
			}

			void startInputAudio(connection).catch((toggleError) => {
				failSession(getErrorMessage(toggleError, "Failed to start microphone input"));
			});
		},
		[failSession, startInputAudio, stopInputAudio],
	);

	const setVideoEnabled = useCallback(
		(enabled: boolean) => {
			const nextEnabled = providerSupportsVideoInput(provider) && enabled;
			videoEnabledRef.current = nextEnabled;
			setIsVideoEnabledState(nextEnabled);

			if (!nextEnabled) {
				stopInputVideo();
				return;
			}

			const connection = connectionRef.current;
			if (
				!isRealtimeWebSocketConnection(connection) ||
				!getConnectionProviderOption(connection).websocket?.videoInput
			) {
				return;
			}

			void startInputVideo(connection).catch((toggleError) => {
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
