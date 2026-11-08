import { afterEach, describe, expect, it, vi } from "vitest";

import { connectOpenAIRealtimeWebRTC } from "./webrtc";

describe("OpenAI realtime WebRTC client", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("rejects untrusted call endpoints before exposing the ephemeral secret", async () => {
    const peerConnectionConstructor = vi.fn();
    const fetchMock = vi.fn();

    vi.stubGlobal("RTCPeerConnection", peerConnectionConstructor);
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      connectOpenAIRealtimeWebRTC({
        session: {
          provider: "openai",
          transport: "webrtc",
          url: "https://attacker.example/realtime/calls",
          client_secret: { value: "ek_secret" },
        },
        stream: { getTracks: () => [] } as unknown as MediaStream,
      }),
    ).rejects.toThrow("require an HTTPS api.openai.com endpoint");
    expect(peerConnectionConstructor).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
