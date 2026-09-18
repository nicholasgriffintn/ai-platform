/**
 * Realtime session and proxy limits. Env overrides are read and clamped by the realtime module.
 */

export const REALTIME_MAX_SESSION_SECONDS_DEFAULT = 1800;
export const REALTIME_MAX_SESSION_SECONDS_MIN = 60;
export const REALTIME_MAX_SESSION_SECONDS_MAX = 3600;
export const REALTIME_RESERVATION_SECONDS = 300;
export const REALTIME_RECONCILIATION_BUFFER_SECONDS = 120;

export const REALTIME_PROXY_GRANT_TTL_SECONDS = 60;
export const MAX_REALTIME_PROXY_SESSIONS_PER_USER = 3;

export const REALTIME_PROXY_LIMITS = {
  clientFrameBytes: 384 * 1024,
  audioFrameBytes: 256 * 1024,
  pendingFrames: 32,
  pendingBytes: 2 * 1024 * 1024,
  sessionAudioBytes: 25 * 1024 * 1024,
  sessionDurationMs: 15 * 60 * 1000,
  upstreamFrameBytes: 2 * 1024 * 1024,
  mappedFramesPerEvent: 32,
  controlMessages: 128,
} as const;
