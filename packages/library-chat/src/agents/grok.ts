import type { DesktopStreamEvent } from "@ngriffin_uk/polychat-schemas";

import { parseAgentProcessOutput } from "./process-output.js";

export const GROK_LOGIN_COMMAND = "grok login" as const;

export function parseGrokOutput(runId: string, line: string): DesktopStreamEvent {
  return parseAgentProcessOutput(runId, line);
}
