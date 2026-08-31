import type { MessagePart } from "~/types";
import { isRecord } from "~/utils/objects";

interface GoogleCodeExecution {
  code: string;
  language: string;
  output: string;
  outcome?: string;
  toolCallId: string;
  toolResultPart?: Extract<MessagePart, { type: "tool_result" }>;
  toolUsePart: Extract<MessagePart, { type: "tool_use" }>;
}

export interface GoogleStreamParts {
  handled: boolean;
  text: string;
}

function mergeStreamedValue(current: string, next: string): string {
  if (!next || current.endsWith(next)) {
    return current;
  }

  if (next.startsWith(current)) {
    return next;
  }

  return current + next;
}

function readGoogleParts(data: unknown): Record<string, unknown>[] | null {
  if (!isRecord(data) || !Array.isArray(data.candidates)) {
    return null;
  }

  const candidate = data.candidates[0];

  if (
    !isRecord(candidate) ||
    !isRecord(candidate.content) ||
    !Array.isArray(candidate.content.parts)
  ) {
    return null;
  }

  return candidate.content.parts.filter(isRecord);
}

function resultStatus(outcome: string | undefined): string | undefined {
  if (!outcome) {
    return undefined;
  }

  return outcome === "OUTCOME_OK" ? "completed" : "error";
}

export class GoogleCodeExecutionCollector {
  private current?: GoogleCodeExecution;
  private executionCount = 0;

  collect(data: unknown, messageParts: MessagePart[], timestamp: number): GoogleStreamParts {
    const parts = readGoogleParts(data);

    if (!parts) {
      return { handled: false, text: "" };
    }

    let text = "";

    for (const part of parts) {
      if (typeof part.text === "string" && !part.thought) {
        text += (text ? "\n" : "") + part.text;
      }

      if (isRecord(part.executableCode)) {
        this.collectCode(part.executableCode, messageParts, timestamp);
      }

      if (isRecord(part.codeExecutionResult)) {
        this.collectResult(part.codeExecutionResult, messageParts, timestamp);
      }
    }

    return { handled: true, text };
  }

  private collectCode(
    payload: Record<string, unknown>,
    messageParts: MessagePart[],
    timestamp: number,
  ): void {
    if (!this.current || this.current.toolResultPart) {
      const providerToolCallId = typeof payload.id === "string" ? payload.id.trim() : "";
      const toolCallId = providerToolCallId || `google-code-execution-${++this.executionCount}`;
      const language =
        typeof payload.language === "string" ? payload.language.toLowerCase() : "code";
      const toolUsePart: Extract<MessagePart, { type: "tool_use" }> = {
        type: "tool_use",
        name: "code_execution",
        toolCallId,
        input: { code: "", language },
        timestamp,
      };

      this.current = {
        code: "",
        language,
        output: "",
        toolCallId,
        toolUsePart,
      };
      messageParts.push(toolUsePart);
    }

    const code = typeof payload.code === "string" ? payload.code : "";

    this.current.code = mergeStreamedValue(this.current.code, code);
    this.current.toolUsePart.input = {
      code: this.current.code,
      language: this.current.language,
    };
  }

  private collectResult(
    payload: Record<string, unknown>,
    messageParts: MessagePart[],
    timestamp: number,
  ): void {
    if (!this.current) {
      this.collectCode(payload, messageParts, timestamp);
    }

    const execution = this.current;

    if (!execution) {
      return;
    }
    const output = typeof payload.output === "string" ? payload.output : "";
    const outcome = typeof payload.outcome === "string" ? payload.outcome : execution.outcome;

    execution.output = mergeStreamedValue(execution.output, output);
    execution.outcome = outcome;

    if (!execution.toolResultPart) {
      execution.toolResultPart = {
        type: "tool_result",
        name: "code_execution",
        toolCallId: execution.toolCallId,
        timestamp,
      };
      messageParts.push(execution.toolResultPart);
    }

    execution.toolResultPart.status = resultStatus(outcome);
    execution.toolResultPart.content =
      execution.output || "Code execution completed without output.";
    execution.toolResultPart.data = {
      responseType: "text",
      providerResult: {
        outcome,
        output: execution.output,
      },
    };
  }
}
