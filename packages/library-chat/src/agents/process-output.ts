import type { DesktopStreamEvent } from "@ngriffin_uk/polychat-schemas";
import { readAssistantOutput } from "@ngriffin_uk/polychat-schemas";

export function parseAgentProcessOutput(runId: string, line: string): DesktopStreamEvent {
  const output = readAssistantOutput(line);

  if (output.error) {
    return { type: "failed", runId, failure: "agent-error", message: output.error.slice(0, 400) };
  }

  if (output.text) {
    return { type: "text", runId, delta: output.text };
  }

  return { type: "progress", runId, state: "generating" };
}
