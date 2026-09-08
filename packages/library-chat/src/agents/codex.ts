import type { DesktopStreamEvent } from "@ngriffin_uk/polychat-schemas";

import { parseAgentProcessOutput } from "./process-output.js";

export const CODEX_CLI_VERSION = "0.153.4" as const;
export const CODEX_LOGIN_COMMAND = "codex login" as const;

export function parseCodexOutput(runId: string, line: string): DesktopStreamEvent {
  return parseAgentProcessOutput(runId, line);
}
