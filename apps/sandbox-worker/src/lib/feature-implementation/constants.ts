import type { PolychatRetryOptions } from "../polychat-client";

export const DEFAULT_MODEL = "mistral-large";
export const MAX_COMMANDS = 30;
export const MAX_AGENT_STEPS = 48;
export const MAX_CONSECUTIVE_COMMAND_FAILURES = 3;
export const MAX_CONTEXT_FILES = 10;
export const MAX_CONTEXT_SNIPPET_LINES = 120;
export const MAX_INSTRUCTION_FILES = 8;
export const MAX_READ_FILE_LINES = 240;
export const MAX_SNIPPET_CHARS = 5000;
export const MAX_OBSERVATION_CHARS = 5000;

export const MODEL_RETRY_OPTIONS: PolychatRetryOptions = {
	maxAttempts: 3,
	baseDelayMs: 500,
	maxDelayMs: 2500,
};
