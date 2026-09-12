import type { SandboxRunEvent } from "@ngriffin_uk/polychat-schemas";

import { readNumberField, readRecordObjectField, readStringField } from "~/utils/recordFields";

type OpenAIAgentTerminalStatus = "completed" | "failed" | "cancelled";

export class OpenAIAgentEventTranslator {
  private readonly textParts = new Map<string, string>();
  sessionId?: string;
  turnId?: string;
  terminalStatus?: OpenAIAgentTerminalStatus;
  error?: string;

  constructor(private readonly runId: string) {}

  handle(event: Record<string, unknown>): SandboxRunEvent[] {
    const type = readStringField(event, "type");

    if (!type) {
      return [];
    }

    if (type === "agent.session.created") {
      this.sessionId = readStringField(readRecordObjectField(event, "session"), "id");

      return [this.event("environment_setup_started", "OpenAI-hosted environment provisioning")];
    }

    if (type === "agent.session.environment.connected") {
      return [this.event("environment_setup_completed", "OpenAI-hosted environment connected")];
    }

    if (type === "agent.session.turn.output_text.delta") {
      const key = this.textPartKey(event);
      const delta = readStringField(event, "delta") ?? "";

      this.textParts.set(key, `${this.textParts.get(key) ?? ""}${delta}`);

      return [];
    }

    if (type === "agent.session.turn.output_text.done") {
      const key = this.textPartKey(event);
      const text = readStringField(event, "text") ?? this.textParts.get(key) ?? "";

      this.textParts.set(key, text);

      return text.trim() ? [this.event("agent_message", text)] : [];
    }

    if (type === "agent.session.turn.completed" && this.isRootTurn(event)) {
      const turn = readRecordObjectField(event, "turn");

      this.turnId = readStringField(turn, "id");
      this.terminalStatus = "completed";

      return [];
    }

    if (type === "agent.session.turn.cancelled" && this.isRootTurn(event)) {
      this.terminalStatus = "cancelled";
      this.error = "The OpenAI-hosted agent turn was cancelled";

      return [];
    }

    if (
      type === "error" ||
      type === "agent.session.failed" ||
      type === "agent.session.environment.failed" ||
      (type === "agent.session.turn.failed" && this.isRootTurn(event))
    ) {
      this.terminalStatus = "failed";
      this.error = this.readError(event) ?? `OpenAI Agents API reported ${type}`;

      return [];
    }

    return [];
  }

  outputText(): string {
    return Array.from(this.textParts.values()).filter(Boolean).join("\n\n");
  }

  private event(type: string, message: string): SandboxRunEvent {
    return {
      type,
      runId: this.runId,
      message,
      timestamp: new Date().toISOString(),
    };
  }

  private textPartKey(event: Record<string, unknown>): string {
    return [
      readStringField(event, "item_id") ?? "item",
      String(readNumberField(event, "output_index") ?? 0),
      String(readNumberField(event, "content_index") ?? 0),
    ].join(":");
  }

  private isRootTurn(event: Record<string, unknown>): boolean {
    const turn = readRecordObjectField(event, "turn");

    return turn.subagent_id === null || turn.subagent_id === undefined;
  }

  private readError(event: Record<string, unknown>): string | undefined {
    const direct = readRecordObjectField(event, "error");
    const turn = readRecordObjectField(event, "turn");
    const turnError = readRecordObjectField(turn, "error");
    const environment = readRecordObjectField(event, "environment");
    const environmentError = readRecordObjectField(environment, "error");

    return (
      readStringField(direct, "message") ??
      readStringField(turnError, "message") ??
      readStringField(environmentError, "message")
    );
  }
}
