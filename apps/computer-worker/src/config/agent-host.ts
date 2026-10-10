export const HERMES_API_PORT = 8642;
export const HERMES_HOME = "/workspace/hermes";
export const HERMES_START_COMMAND = "/usr/local/bin/start-hermes";
export const HERMES_PROCESS_ID = "hermes-gateway";
export const HERMES_STARTUP_TIMEOUT_MS = 180_000;
export const HERMES_REQUEST_TIMEOUT_MS = 30_000;
export const AGENT_HOST_SLEEP_AFTER = "15m";
export const AGENT_HOST_CHECKPOINT_TTL_SECONDS = 90 * 24 * 60 * 60;
export const AGENT_HOST_CHECKPOINT_EXCLUDES = [
  "*.lock",
  "*.pid",
  "*.sock",
  "*.sock.path",
  "logs",
  "cache",
  "audio_cache",
  "image_cache",
];
export const POLYCHAT_MODEL_HOST = "polychat.internal";
export const POLYCHAT_MODEL_NAME = "polychat";
export const POLYCHAT_MODELS_HANDLER = "polychatModels";
export const AGENT_HOST_EGRESS_HANDLER = "agentHostEgress";
