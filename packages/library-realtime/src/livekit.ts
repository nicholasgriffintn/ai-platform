import { Room, RoomEvent, Track } from "livekit-client";

import { parseRealtimeJsonMessage } from "./messages";
import type { RealtimeConnection, RealtimeSession } from "./types";

const VOICE_AGENT_EVENTS_TOPIC = "voice_agent.events";

export interface RealtimeLiveKitConnection extends RealtimeConnection {
  room: Room;
}

export interface ConnectRealtimeLiveKitOptions {
  session: RealtimeSession;
  stream: MediaStream;
  signal?: AbortSignal;
  onAgentEvent?: (payload: unknown) => void;
  onDisconnected?: () => void;
  onRemoteAudio?: (stream: MediaStream) => void;
}

function requireLiveKitCredentials(session: RealtimeSession): { token: string; url: string } {
  const token = session.client_secret?.value;

  if (session.transport !== "livekit" || !session.url || !token) {
    throw new Error("Expected a LiveKit realtime session with a server URL and participant token");
  }

  return { token, url: session.url };
}

export async function connectRealtimeLiveKit({
  session,
  stream,
  signal,
  onAgentEvent,
  onDisconnected,
  onRemoteAudio,
}: ConnectRealtimeLiveKitOptions): Promise<RealtimeLiveKitConnection> {
  const { token, url } = requireLiveKitCredentials(session);
  const [microphoneTrack] = stream.getAudioTracks();

  if (!microphoneTrack) {
    throw new Error("A microphone track is required for a voice agent session");
  }

  const room = new Room();
  const close = () => void room.disconnect();

  room.on(RoomEvent.DataReceived, (payload, participant, _kind, topic) => {
    if (topic !== VOICE_AGENT_EVENTS_TOPIC || !participant?.isAgent) {
      return;
    }

    onAgentEvent?.(parseRealtimeJsonMessage(new TextDecoder().decode(payload)));
  });
  room.on(RoomEvent.TrackSubscribed, (track) => {
    if (track.kind === Track.Kind.Audio) {
      onRemoteAudio?.(new MediaStream([track.mediaStreamTrack]));
    }
  });
  room.on(RoomEvent.Disconnected, () => onDisconnected?.());
  signal?.addEventListener("abort", close, { once: true });

  await room.connect(url, token);

  if (signal?.aborted) {
    close();

    throw new DOMException("Voice agent session was cancelled", "AbortError");
  }

  await room.localParticipant.publishTrack(microphoneTrack, { source: Track.Source.Microphone });

  return { session, room, close };
}
