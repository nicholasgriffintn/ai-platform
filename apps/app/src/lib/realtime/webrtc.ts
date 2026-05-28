import type { RealtimeConnection, RealtimeSession } from "./types";

const DEFAULT_OPENAI_REALTIME_CALL_URL = "https://api.openai.com/v1/realtime/calls";

export interface RealtimeWebRTCConnection extends RealtimeConnection {
	peerConnection: RTCPeerConnection;
	dataChannel: RTCDataChannel;
}

export interface ConnectOpenAIRealtimeWebRTCOptions {
	session: RealtimeSession;
	stream: MediaStream;
	peerConnectionConfig?: RTCConfiguration;
	dataChannelLabel?: string;
	dataChannelInit?: RTCDataChannelInit;
	offerOptions?: RTCOfferOptions;
	signal?: AbortSignal;
	onPeerConnection?: (peerConnection: RTCPeerConnection) => void;
	configurePeerConnection?: (peerConnection: RTCPeerConnection) => void;
	onTrack?: (event: RTCTrackEvent) => void;
	onIceConnectionStateChange?: (peerConnection: RTCPeerConnection) => void;
	onDataChannelOpen?: (event: Event) => void;
	onDataChannelClose?: (event: Event) => void;
	onDataChannelError?: (event: Event) => void;
	onDataChannelMessage?: (event: MessageEvent) => void;
}

export type ConnectRealtimeWebRTCOptions = ConnectOpenAIRealtimeWebRTCOptions;

export function preferOpusAudioCodec(peerConnection: RTCPeerConnection): void {
	const audioTransceiver = peerConnection
		.getTransceivers()
		.find((transceiver) => transceiver.receiver.track.kind === "audio");

	if (!audioTransceiver) {
		return;
	}

	const codecs = RTCRtpSender.getCapabilities("audio")?.codecs ?? [];
	const opusCodec = codecs.find(
		(codec) => codec.mimeType === "audio/opus" && codec.clockRate === 48000,
	);

	if (opusCodec) {
		audioTransceiver.setCodecPreferences([opusCodec]);
	}
}

function requireOpenAIClientSecret(session: RealtimeSession): string {
	const clientSecret = session.client_secret?.value;
	if (!clientSecret) {
		throw new Error("OpenAI realtime session is missing a client secret");
	}

	return clientSecret;
}

function validateOpenAIWebRTCSession(session: RealtimeSession): void {
	if (session.provider && session.provider !== "openai") {
		throw new Error(`Expected an OpenAI realtime session, received ${session.provider}`);
	}

	if (session.transport && session.transport !== "webrtc") {
		throw new Error(`Expected a WebRTC realtime session, received ${session.transport}`);
	}
}

function closeWebRTCConnection(
	peerConnection: RTCPeerConnection,
	dataChannel?: RTCDataChannel,
): void {
	try {
		dataChannel?.close();
	} catch {
		// Data channels can already be closed by the peer.
	}

	try {
		peerConnection.close();
	} catch {
		// Peer connections can already be closed by browser teardown.
	}
}

export async function connectOpenAIRealtimeWebRTC({
	session,
	stream,
	peerConnectionConfig,
	dataChannelLabel = "oai-events",
	dataChannelInit,
	offerOptions,
	signal,
	onPeerConnection,
	configurePeerConnection,
	onTrack,
	onIceConnectionStateChange,
	onDataChannelOpen,
	onDataChannelClose,
	onDataChannelError,
	onDataChannelMessage,
}: ConnectOpenAIRealtimeWebRTCOptions): Promise<RealtimeWebRTCConnection> {
	validateOpenAIWebRTCSession(session);
	const clientSecret = requireOpenAIClientSecret(session);
	const callUrl = session.url ?? DEFAULT_OPENAI_REALTIME_CALL_URL;

	const peerConnection = new RTCPeerConnection(peerConnectionConfig);
	let dataChannel: RTCDataChannel | undefined;

	try {
		signal?.throwIfAborted();
		onPeerConnection?.(peerConnection);

		if (onTrack) {
			peerConnection.ontrack = onTrack;
		}

		for (const track of stream.getTracks()) {
			peerConnection.addTrack(track, stream);
		}

		configurePeerConnection?.(peerConnection);

		peerConnection.oniceconnectionstatechange = () => onIceConnectionStateChange?.(peerConnection);

		dataChannel = peerConnection.createDataChannel(dataChannelLabel, dataChannelInit);
		if (onDataChannelOpen) {
			dataChannel.addEventListener("open", onDataChannelOpen);
		}
		if (onDataChannelClose) {
			dataChannel.addEventListener("close", onDataChannelClose);
		}
		if (onDataChannelError) {
			dataChannel.addEventListener("error", onDataChannelError);
		}
		if (onDataChannelMessage) {
			dataChannel.addEventListener("message", onDataChannelMessage);
		}

		const offer = await peerConnection.createOffer(offerOptions);
		await peerConnection.setLocalDescription(offer);
		signal?.throwIfAborted();

		const answerResponse = await fetch(callUrl, {
			method: "POST",
			body: offer.sdp,
			headers: {
				Authorization: `Bearer ${clientSecret}`,
				"Content-Type": "application/sdp",
			},
			signal,
		});

		if (!answerResponse.ok) {
			throw new Error(`Failed to get SDP answer: ${answerResponse.status}`);
		}

		const answerSdp = await answerResponse.text();
		await peerConnection.setRemoteDescription({ type: "answer", sdp: answerSdp });

		return {
			session,
			peerConnection,
			dataChannel,
			close: () => closeWebRTCConnection(peerConnection, dataChannel),
		};
	} catch (error) {
		closeWebRTCConnection(peerConnection, dataChannel);
		throw error;
	}
}

export function connectRealtimeWebRTC(
	options: ConnectRealtimeWebRTCOptions,
): Promise<RealtimeWebRTCConnection> {
	return connectOpenAIRealtimeWebRTC(options);
}
