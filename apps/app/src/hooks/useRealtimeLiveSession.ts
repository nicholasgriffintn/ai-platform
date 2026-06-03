import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { createRealtimeSession } from "~/lib/api/realtime-service";
import { getErrorMessage } from "~/lib/errors";
import {
	connectRealtimeWebRTC,
	connectRealtimeWebSocket,
	isRealtimeWebSocketConnection,
	preferOpusAudioCodec,
	sendJsonWhenOpen,
	type RealtimeConnection,
	type RealtimeWebSocketConnection,
} from "~/lib/realtime";
import {
	arrayBufferToBase64,
	createPcm16AudioPlayer,
	listRealtimeVideoInputDevices,
	requestRealtimeAudioStream,
	requestRealtimeVideoStream,
	setMediaStreamTrackEnabled,
	startJpegFrameStream,
	startPcm16MicrophoneStream,
	stopMediaStream,
	type Pcm16AudioPlayer,
	type RealtimeMediaController,
} from "~/lib/realtime/audio";
import {
	calculatePcm16AudioLevel,
	calculatePcm16Base64AudioLevel,
	createMediaStreamAudioLevelMeter,
	type MediaStreamAudioLevelMeter,
} from "~/lib/realtime/audio-levels";
import {
	createAudioCommitGateState,
	observeAudioCommitGateSpeech,
	resetAudioCommitGate,
	shouldCommitAudioGate,
} from "~/lib/realtime/audio-commit-gate";
import {
	extractRealtimeErrorMessage,
	extractRealtimeEvent,
	extractRealtimeEventLabel,
	extractRealtimeEventType,
	extractRealtimeTranscript,
	parseRealtimeJsonMessage,
	parseRealtimeMessageData,
	type RealtimeEventResult,
	type RealtimeTranscriptResult,
} from "~/lib/realtime/messages";
import { formatRealtimeWebSocketCloseError } from "~/lib/realtime/errors";
import {
	DEFAULT_REALTIME_LIVE_PROVIDER_ID,
	getRealtimeLiveProviderOption,
	supportsRealtimeLiveVideoInput,
	type RealtimeLiveProviderId,
	type RealtimeLiveProviderOption,
} from "~/lib/realtime/live-providers";

export type RealtimeLiveStatus = "idle" | "connecting" | "active" | "error";

export interface RealtimeCameraDevice {
	deviceId: string;
	label: string;
}

interface UseRealtimeLiveSessionOptions {
	model?: string | null;
	onEvent?: (event: RealtimeEventResult) => void;
	onTranscript?: (transcript: RealtimeTranscriptResult) => void;
}

interface CleanupOptions {
	closeConnection?: boolean;
}

function getConnectionProviderOption(connection: RealtimeConnection): RealtimeLiveProviderOption {
	return getRealtimeLiveProviderOption(connection.session.provider ?? "");
}

function createCameraDeviceOption(device: MediaDeviceInfo, index: number): RealtimeCameraDevice {
	return {
		deviceId: device.deviceId,
		label: device.label || `Camera ${index + 1}`,
	};
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

function sendConfiguredAudioCommit(connection: RealtimeWebSocketConnection): void {
	const audioInput = getConnectionProviderOption(connection).websocket?.audioInput;
	if (!audioInput) {
		return;
	}

	for (const message of audioInput.commitMessages ?? []) {
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
	const [inputAudioLevel, setInputAudioLevel] = useState(0);
	const [outputAudioLevel, setOutputAudioLevel] = useState(0);
	const [cameraDevices, setCameraDevices] = useState<RealtimeCameraDevice[]>([]);
	const [selectedCameraDeviceId, setSelectedCameraDeviceIdState] = useState("");
	const [videoPreviewStream, setVideoPreviewStream] = useState<MediaStream | null>(null);

	const abortControllerRef = useRef<AbortController | null>(null);
	const audioPlayerRef = useRef<Pcm16AudioPlayer | null>(null);
	const connectionRef = useRef<RealtimeConnection | null>(null);
	const inputAudioControllerRef = useRef<RealtimeMediaController | null>(null);
	const inputAudioMeterRef = useRef<MediaStreamAudioLevelMeter | null>(null);
	const inputVideoControllerRef = useRef<RealtimeMediaController | null>(null);
	const finalizingConnectionRef = useRef<RealtimeWebSocketConnection | null>(null);
	const audioCommitGateRef = useRef(createAudioCommitGateState());
	const silenceCommitTimeoutRef = useRef<number | null>(null);
	const audioStreamRef = useRef<MediaStream | null>(null);
	const outputAudioLevelResetRef = useRef<number | null>(null);
	const outputAudioMeterRef = useRef<MediaStreamAudioLevelMeter | null>(null);
	const videoStreamRef = useRef<MediaStream | null>(null);
	const microphoneEnabledRef = useRef(true);
	const videoEnabledRef = useRef(false);
	const selectedCameraDeviceIdRef = useRef("");
	const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
	const statusRef = useRef(status);
	const stoppingRef = useRef(false);
	const [isMicrophoneEnabled, setIsMicrophoneEnabledState] = useState(true);
	const [isVideoEnabled, setIsVideoEnabledState] = useState(false);

	const setLiveStatus = useCallback((nextStatus: RealtimeLiveStatus) => {
		statusRef.current = nextStatus;
		setStatus(nextStatus);
	}, []);

	const stopInputAudioMeter = useCallback(() => {
		inputAudioMeterRef.current?.stop();
		inputAudioMeterRef.current = null;
		setInputAudioLevel(0);
	}, []);

	const startInputAudioMeter = useCallback((stream: MediaStream) => {
		if (inputAudioMeterRef.current) {
			return;
		}

		inputAudioMeterRef.current = createMediaStreamAudioLevelMeter({
			stream,
			onLevel: (level) => {
				setInputAudioLevel(microphoneEnabledRef.current ? level : 0);
			},
		});
	}, []);

	const clearOutputAudioLevelReset = useCallback(() => {
		if (outputAudioLevelResetRef.current === null) {
			return;
		}

		window.clearTimeout(outputAudioLevelResetRef.current);
		outputAudioLevelResetRef.current = null;
	}, []);

	const clearSilenceCommitTimer = useCallback(() => {
		if (silenceCommitTimeoutRef.current === null) {
			return;
		}

		window.clearTimeout(silenceCommitTimeoutRef.current);
		silenceCommitTimeoutRef.current = null;
	}, []);

	const resetAudioTurnDetection = useCallback(() => {
		clearSilenceCommitTimer();
		resetAudioCommitGate(audioCommitGateRef.current);
	}, [clearSilenceCommitTimer]);

	const resetOutputAudioLevelSoon = useCallback(() => {
		clearOutputAudioLevelReset();
		outputAudioLevelResetRef.current = window.setTimeout(() => {
			outputAudioLevelResetRef.current = null;
			setOutputAudioLevel(0);
		}, 200);
	}, [clearOutputAudioLevelReset]);

	const refreshCameraDevices = useCallback(async () => {
		const devices = (await listRealtimeVideoInputDevices()).map(createCameraDeviceOption);
		setCameraDevices(devices);

		if (
			selectedCameraDeviceIdRef.current &&
			devices.some((device) => device.deviceId === selectedCameraDeviceIdRef.current)
		) {
			return;
		}

		const nextDeviceId = devices[0]?.deviceId ?? "";
		selectedCameraDeviceIdRef.current = nextDeviceId;
		setSelectedCameraDeviceIdState(nextDeviceId);
	}, []);

	const stopOutputAudioMeter = useCallback(() => {
		outputAudioMeterRef.current?.stop();
		outputAudioMeterRef.current = null;
		clearOutputAudioLevelReset();
		setOutputAudioLevel(0);
	}, [clearOutputAudioLevelReset]);

	const startOutputAudioMeter = useCallback(
		(stream: MediaStream) => {
			stopOutputAudioMeter();
			outputAudioMeterRef.current = createMediaStreamAudioLevelMeter({
				stream,
				onLevel: setOutputAudioLevel,
			});
		},
		[stopOutputAudioMeter],
	);

	const handleOutputAudioChunk = useCallback(
		(base64Audio: string) => {
			setOutputAudioLevel(calculatePcm16Base64AudioLevel(base64Audio));
			resetOutputAudioLevelSoon();
		},
		[resetOutputAudioLevelSoon],
	);

	const maybeCommitAudioAfterSilence = useCallback(
		(connection: RealtimeWebSocketConnection, chunk: ArrayBuffer) => {
			const config = getConnectionProviderOption(connection).websocket?.audioInput?.commitOnSilence;
			if (!config || stoppingRef.current || !microphoneEnabledRef.current) {
				return;
			}

			const now = Date.now();
			const level = calculatePcm16AudioLevel(chunk);
			if (
				!observeAudioCommitGateSpeech(audioCommitGateRef.current, config, {
					level,
					now,
				})
			) {
				return;
			}

			clearSilenceCommitTimer();

			silenceCommitTimeoutRef.current = window.setTimeout(() => {
				silenceCommitTimeoutRef.current = null;
				if (
					connectionRef.current !== connection ||
					stoppingRef.current ||
					!shouldCommitAudioGate(audioCommitGateRef.current, config, Date.now())
				) {
					return;
				}

				sendConfiguredAudioCommit(connection);
			}, config.silenceMs);
		},
		[clearSilenceCommitTimer],
	);

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

		const stream = await requestRealtimeAudioStream();
		setMediaStreamTrackEnabled(stream, "audio", microphoneEnabledRef.current);
		audioStreamRef.current = stream;
		startInputAudioMeter(stream);
		return stream;
	}, [startInputAudioMeter]);

	const ensureVideoStream = useCallback(async (): Promise<MediaStream> => {
		if (videoStreamRef.current) {
			return videoStreamRef.current;
		}

		const stream = await requestRealtimeVideoStream(selectedCameraDeviceIdRef.current || undefined);
		videoStreamRef.current = stream;
		setVideoPreviewStream(stream);
		void refreshCameraDevices();
		return stream;
	}, [refreshCameraDevices]);

	const stopInputAudio = useCallback(
		(notifyProvider = false) => {
			inputAudioControllerRef.current?.stop();
			inputAudioControllerRef.current = null;
			stopInputAudioMeter();

			const connection = connectionRef.current;
			if (notifyProvider && isRealtimeWebSocketConnection(connection)) {
				sendConfiguredAudioEnd(connection, { forMicrophonePause: true });
			}

			if (connection?.session.transport === "webrtc") {
				setMediaStreamTrackEnabled(audioStreamRef.current, "audio", false);
				return;
			}

			stopMediaStream(audioStreamRef.current);
			audioStreamRef.current = null;
		},
		[stopInputAudioMeter],
	);

	const stopInputVideo = useCallback(() => {
		inputVideoControllerRef.current?.stop();
		inputVideoControllerRef.current = null;
		stopMediaStream(videoStreamRef.current);
		videoStreamRef.current = null;
		setVideoPreviewStream(null);
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
				onChunk: (chunk) => {
					sendJsonWhenOpen(connection, audioInput.buildAppendMessage(arrayBufferToBase64(chunk)));
					maybeCommitAudioAfterSilence(connection, chunk);
				},
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
		[ensureAudioStream, maybeCommitAudioAfterSilence],
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
			resetAudioTurnDetection();
			audioPlayerRef.current?.stop();
			audioPlayerRef.current = null;
			stopOutputAudioMeter();

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

			stopMediaStream(audioStreamRef.current);
			audioStreamRef.current = null;
			stopMediaStream(videoStreamRef.current);
			videoStreamRef.current = null;

			if (updateState) {
				setLiveStatus(nextStatus);
				if (nextStatus === "idle") {
					setLastEvent("Idle");
				}
			}
			stoppingRef.current = false;
		},
		[resetAudioTurnDetection, setLiveStatus, stopInputAudio, stopInputVideo, stopOutputAudioMeter],
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
					const outputStream = event.streams[0] ?? new MediaStream([event.track]);
					remoteAudio.srcObject = outputStream;
					startOutputAudioMeter(outputStream);
					void remoteAudio.play().catch(() => {
						setLastEvent("Tap Live again if the browser blocked playback");
					});
				},
			});

			connectionRef.current = connection;
			setLastEvent("Realtime session listening");
			setLiveStatus("active");
		},
		[ensureAudioStream, failSession, handleRealtimePayload, setLiveStatus, startOutputAudioMeter],
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
					void parseRealtimeMessageData(event.data).then((payload) => {
						if (connectionRef.current !== connection || stoppingRef.current) {
							return;
						}

						const eventType = extractRealtimeEventType(payload);
						if (websocketConfig.setup?.isCompleteMessage(payload)) {
							void startWebSocketMedia();
						}
						if (eventType === "response.interrupted" && websocketConfig.audioOutput) {
							audioPlayerRef.current?.stop();
							audioPlayerRef.current = createPcm16AudioPlayer({
								sampleRate: websocketConfig.audioOutput.sampleRate,
							});
							setOutputAudioLevel(0);
						}
						handleRealtimePayload(payload);
						for (const chunk of websocketConfig.audioOutput?.extractChunks(payload) ?? []) {
							audioPlayerRef.current?.playBase64(chunk);
							handleOutputAudioChunk(chunk);
						}
						if (isConfiguredAudioEndEvent(connection, payload)) {
							completePendingFinalization(connection);
						}
					});
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
			handleOutputAudioChunk,
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
				setMediaStreamTrackEnabled(audioStreamRef.current, "audio", enabled);
				if (!enabled) {
					setInputAudioLevel(0);
				} else if (audioStreamRef.current) {
					startInputAudioMeter(audioStreamRef.current);
				}
				return;
			}

			if (!enabled) {
				resetAudioTurnDetection();
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
		[failSession, resetAudioTurnDetection, startInputAudio, startInputAudioMeter, stopInputAudio],
	);

	const setVideoEnabled = useCallback(
		(enabled: boolean) => {
			const nextEnabled = supportsRealtimeLiveVideoInput(provider) && enabled;
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
				void ensureVideoStream().catch((toggleError) => {
					videoEnabledRef.current = false;
					setIsVideoEnabledState(false);
					setError(getErrorMessage(toggleError, "Failed to start camera preview"));
					toast.error(getErrorMessage(toggleError, "Failed to start camera preview"));
				});
				return;
			}

			void startInputVideo(connection).catch((toggleError) => {
				failSession(getErrorMessage(toggleError, "Failed to start video input"));
			});
		},
		[ensureVideoStream, failSession, provider, startInputVideo, stopInputVideo],
	);

	const setCameraDeviceId = useCallback(
		(nextDeviceId: string) => {
			if (selectedCameraDeviceIdRef.current === nextDeviceId) {
				return;
			}

			selectedCameraDeviceIdRef.current = nextDeviceId;
			setSelectedCameraDeviceIdState(nextDeviceId);

			if (!videoEnabledRef.current) {
				return;
			}

			stopInputVideo();
			const connection = connectionRef.current;
			if (
				isRealtimeWebSocketConnection(connection) &&
				getConnectionProviderOption(connection).websocket?.videoInput
			) {
				void startInputVideo(connection).catch((toggleError) => {
					failSession(getErrorMessage(toggleError, "Failed to switch camera"));
				});
				return;
			}

			void ensureVideoStream().catch((toggleError) => {
				videoEnabledRef.current = false;
				setIsVideoEnabledState(false);
				setError(getErrorMessage(toggleError, "Failed to switch camera"));
				toast.error(getErrorMessage(toggleError, "Failed to switch camera"));
			});
		},
		[ensureVideoStream, failSession, startInputVideo, stopInputVideo],
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

	useEffect(() => {
		void refreshCameraDevices();
		navigator.mediaDevices?.addEventListener?.("devicechange", refreshCameraDevices);
		return () => {
			navigator.mediaDevices?.removeEventListener?.("devicechange", refreshCameraDevices);
		};
	}, [refreshCameraDevices]);

	useEffect(() => () => cleanup("idle", false), [cleanup]);

	return {
		cameraDevices,
		error,
		inputAudioLevel,
		isActive: status === "active",
		isConnecting: status === "connecting",
		isMicrophoneEnabled,
		isVideoEnabled,
		lastEvent,
		lastTranscript,
		provider,
		outputAudioLevel,
		selectedCameraDeviceId,
		setCameraDeviceId,
		setMicrophoneEnabled,
		setProvider: changeProvider,
		setVideoEnabled,
		start,
		status,
		stop,
		videoPreviewStream,
	};
}
