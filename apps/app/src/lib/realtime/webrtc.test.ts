import { afterEach, describe, expect, it, vi } from "vitest";

import { connectOpenAIRealtimeWebRTC } from "./webrtc";

class FakeRTCDataChannel extends EventTarget {
	closed = false;

	close() {
		this.closed = true;
	}
}

const setCodecPreferences = vi.fn();

class FakeRTCPeerConnection {
	static latest: FakeRTCPeerConnection | undefined;

	dataChannel: FakeRTCDataChannel | undefined;
	iceConnectionState: RTCIceConnectionState = "new";
	addTrack = vi.fn();
	createOffer = vi.fn(async () => ({ type: "offer", sdp: "offer-sdp" }));
	setLocalDescription = vi.fn(async () => undefined);
	setRemoteDescription = vi.fn(async () => undefined);
	close = vi.fn(() => {
		this.iceConnectionState = "closed";
	});
	restartIce = vi.fn();
	getTransceivers = vi.fn(() => [
		{
			receiver: {
				track: {
					kind: "audio",
				},
			},
			setCodecPreferences,
		},
	]);
	createDataChannel = vi.fn(() => {
		this.dataChannel = new FakeRTCDataChannel();
		return this.dataChannel;
	});

	constructor(public configuration?: RTCConfiguration) {
		FakeRTCPeerConnection.latest = this;
	}
}

describe("OpenAI realtime WebRTC client", () => {
	afterEach(() => {
		vi.restoreAllMocks();
		vi.unstubAllGlobals();
		FakeRTCPeerConnection.latest = undefined;
		setCodecPreferences.mockClear();
	});

	it("posts the SDP offer to the session URL and applies the answer", async () => {
		vi.stubGlobal("RTCPeerConnection", FakeRTCPeerConnection);
		vi.stubGlobal("RTCRtpSender", {
			getCapabilities: () => ({
				codecs: [{ mimeType: "audio/opus", clockRate: 48000 }],
			}),
		});
		const fetchMock = vi.fn(async () => new Response("answer-sdp", { status: 200 }));
		vi.stubGlobal("fetch", fetchMock);

		const track = { kind: "audio" } as MediaStreamTrack;
		const stream = {
			getTracks: () => [track],
		} as unknown as MediaStream;

		const connection = await connectOpenAIRealtimeWebRTC({
			session: {
				provider: "openai",
				transport: "webrtc",
				url: "https://api.openai.com/v1/realtime/calls",
				client_secret: {
					value: "ek_test",
				},
			},
			stream,
			configurePeerConnection: (peerConnection) => {
				const transceiver = peerConnection.getTransceivers()[0];
				transceiver.setCodecPreferences([]);
			},
		});

		const peerConnection = FakeRTCPeerConnection.latest!;
		expect(peerConnection.addTrack).toHaveBeenCalledWith(track, stream);
		expect(fetchMock).toHaveBeenCalledWith(
			"https://api.openai.com/v1/realtime/calls",
			expect.objectContaining({
				method: "POST",
				body: "offer-sdp",
				headers: {
					Authorization: "Bearer ek_test",
					"Content-Type": "application/sdp",
				},
			}),
		);
		expect(peerConnection.setRemoteDescription).toHaveBeenCalledWith({
			type: "answer",
			sdp: "answer-sdp",
		});

		connection.close();
		expect((connection.dataChannel as unknown as FakeRTCDataChannel).closed).toBe(true);
		expect(peerConnection.close).toHaveBeenCalled();
	});

	it("rejects non-OpenAI sessions before creating a peer connection", async () => {
		const peerConnectionConstructor = vi.fn();
		vi.stubGlobal("RTCPeerConnection", peerConnectionConstructor);

		await expect(
			connectOpenAIRealtimeWebRTC({
				session: {
					provider: "google-ai-studio",
					transport: "websocket",
					url: "wss://example.test/live",
				},
				stream: { getTracks: () => [] } as unknown as MediaStream,
			}),
		).rejects.toThrow("Expected an OpenAI realtime session");
		expect(peerConnectionConstructor).not.toHaveBeenCalled();
	});
});
