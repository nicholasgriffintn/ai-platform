/**
 * Service-wide size, time and count limits.
 *
 * Anything a module enforces against user input or provider output belongs here so the bounds can
 * be reviewed in one place. Module-specific rules (what to do when a limit is hit) stay with the
 * module.
 */

// Content and streaming
export const MAX_CONTENT_LENGTH = 1_000_000; // 1MB
export const MAX_THINKING_LENGTH = 500_000; // 500KB
export const MAX_PROVIDER_STREAM_EVENT_LENGTH = 20 * 1024 * 1024; // 20MB

// Uploads and media
export const MAX_TRANSCRIPTION_BYTES = 25 * 1024 * 1024;
export const MAX_OCR_IMAGE_BYTES = 10 * 1024 * 1024;
export const MAX_OCR_DOCUMENT_BYTES = 25 * 1024 * 1024;

// Connectors
export const COMPOSIO_FILE_MAX_BYTES = 25 * 1024 * 1024;
export const COMPOSIO_FILE_TRANSFER_TIMEOUT_MS = 15_000;

// Tasks and interactions
export const MAX_QUEUE_DELAY_SECONDS = 60 * 60 * 12;
export const PROJECT_TASK_INTERACTION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

// Tool call budgets
export const MAX_META_FIND_LIMIT = 20;
export const MAX_META_READ_MESSAGES = 60;
export const MAX_META_ATTENTION_LIMIT = 25;
export const MAX_REVIEWERS = 4;
export const MAX_SOURCE_LENGTH = 12_000;
export const MAX_COUNCIL_MEMBERS = 6;
export const MAX_COUNCIL_TURNS = 8;
export const MAX_TASK_LIMIT = 10;

// Media generation defaults
export const VIDEO_DEFAULT_HEIGHT = 320;
export const VIDEO_DEFAULT_WIDTH = 576;
export const VIDEO_MAX_DIMENSION = 1280;
export const VIDEO_DEFAULT_FRAMES = 24;
export const VIDEO_DEFAULT_GUIDANCE_SCALE = 6;
export const VIDEO_MIN_GUIDANCE_SCALE = 1;
export const VIDEO_DEFAULT_INFER_STEPS = 50;
export const VIDEO_MIN_INFER_STEPS = 1;
export const VIDEO_DEFAULT_FLOW_SHIFT = 7;
export const MUSIC_DEFAULT_DURATION = 8;
