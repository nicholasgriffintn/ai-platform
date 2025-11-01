import { md } from "~/utils/markdown.js";

export const realtimeTagDescription = md`# Realtime

Create low-latency inference sessions for speech-driven or synchronous experiences.

Only authenticated users may create sessions; invalid types or models return structured error payloads, and successful responses include everything needed to negotiate WebRTC/WebSocket connections with the provider.`;
