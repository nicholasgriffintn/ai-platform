/**
 * Chat-turn configuration: how much history and how many events a turn keeps, and how much
 * repeated work a turn tolerates. Enforcement lives in the chat module.
 */
export const MAX_STORED_STREAM_EVENTS = 500;
export const MAX_PANEL_TURNS = 10;
export const DEFAULT_MAX_IDENTICAL_TOOL_CALLS = 3;
