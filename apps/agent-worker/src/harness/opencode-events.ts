import type { AgentHarnessEvent } from "@ngriffin_uk/polychat-schemas";
import type { OpenCodeEvent } from "agents/harness/opencode";

export function openCodeEventToHarnessEvent(event: OpenCodeEvent): AgentHarnessEvent | undefined {
  switch (event.type) {
    case "session.text.delta":
      return {
        type: "text-delta",
        partId: `${event.data.assistantMessageID}-${event.data.ordinal}`,
        delta: event.data.delta,
      };
    case "session.reasoning.delta":
      return {
        type: "reasoning-delta",
        partId: `${event.data.assistantMessageID}-${event.data.ordinal}`,
        delta: event.data.delta,
      };
    default:
      return undefined;
  }
}
