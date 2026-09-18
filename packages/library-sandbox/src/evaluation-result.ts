import { isRecord } from "@ngriffin_uk/polychat-utility-core";

import { SandboxError } from "./errors.js";

export type EvaluationLogLevel = "log" | "info" | "warn" | "error" | "debug";

export interface EvaluationLogEntry {
  level: EvaluationLogLevel;
  message: string;
  at: number;
}

export interface EvaluationFailure {
  name: string;
  message: string;
  stack?: string;
}

export type EvaluationOutcome =
  | { ok: true; value: unknown; logs: EvaluationLogEntry[]; durationMs: number }
  | { ok: false; error: EvaluationFailure; logs: EvaluationLogEntry[]; durationMs: number };

const LOG_LEVELS: ReadonlySet<string> = new Set(["log", "info", "warn", "error", "debug"]);

function readLogs(value: unknown): EvaluationLogEntry[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((entry) =>
    isRecord(entry) &&
    typeof entry.level === "string" &&
    LOG_LEVELS.has(entry.level) &&
    typeof entry.message === "string"
      ? [
          {
            level: entry.level as EvaluationLogLevel,
            message: entry.message,
            at: typeof entry.at === "number" ? entry.at : 0,
          },
        ]
      : [],
  );
}

export function parseEvaluationOutcome(value: unknown): EvaluationOutcome {
  if (!isRecord(value) || typeof value.ok !== "boolean") {
    throw new SandboxError("invalid_result", "The sandbox returned a malformed evaluation result");
  }

  const logs = readLogs(value.logs);
  const durationMs = typeof value.durationMs === "number" ? value.durationMs : 0;

  if (value.ok) {
    return { ok: true, value: value.value ?? null, logs, durationMs };
  }

  const error = isRecord(value.error) ? value.error : {};

  return {
    ok: false,
    error: {
      name: typeof error.name === "string" ? error.name : "Error",
      message: typeof error.message === "string" ? error.message : "Evaluation failed",
      ...(typeof error.stack === "string" ? { stack: error.stack } : {}),
    },
    logs,
    durationMs,
  };
}
