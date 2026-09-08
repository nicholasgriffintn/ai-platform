import type { DesktopStreamEvent } from "@ngriffin_uk/polychat-schemas";

import { parseAgentProcessOutput } from "./process-output.js";

export const CURSOR_LOGIN_COMMAND = "agent login" as const;

export function parseCursorOutput(runId: string, line: string): DesktopStreamEvent {
  return parseAgentProcessOutput(runId, line);
}
