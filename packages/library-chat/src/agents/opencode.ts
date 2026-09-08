import type { DesktopStreamEvent } from "@ngriffin_uk/polychat-schemas";

import { parseAgentProcessOutput } from "./process-output.js";

export const OPENCODE_LOGIN_COMMAND = "opencode auth login" as const;

export function parseOpenCodeOutput(runId: string, line: string): DesktopStreamEvent {
  return parseAgentProcessOutput(runId, line);
}
