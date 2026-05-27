import { md } from "~/utils/markdown.js";

export const realtimeTagDescription = md`
# Realtime

Create low-latency live sessions for speech, translation, transcription, and multimodal voice or vision experiences.

Only authenticated users may create sessions; invalid types or models return structured error payloads, and successful responses include everything needed to negotiate WebRTC/WebSocket connections with the provider.
`;
