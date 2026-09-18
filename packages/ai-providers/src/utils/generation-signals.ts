import { isRecord } from "@ngriffin_uk/polychat-utility-core";
import {
  readNumberField,
  readStringField,
} from "@ngriffin_uk/polychat-utility-server/record-fields";

import type { ToolDefinitionLike } from "../tool-definitions.js";
import type { ChatCompletionParameters } from "../types/index.js";

const TOOL_CALL_OUTPUT_FIELDS = ["tool_calls", "response", "output", "content"] as const;
const TOOL_ITEM_TYPES = new Set(["tool_use", "function_call"]);

export function readToolName(value: unknown): string | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const direct = readStringField(value, "name");

  if (direct) {
    return direct;
  }

  const fn = value.function;

  return isRecord(fn) ? readStringField(fn, "name") : undefined;
}

function collectToolNames(source: unknown, names: Set<string>): void {
  if (!Array.isArray(source)) {
    return;
  }

  for (const item of source) {
    const name = readToolName(item);

    if (name) {
      names.add(name);
    }
  }
}

function collectToolItemNames(source: unknown, names: Set<string>): void {
  if (!Array.isArray(source)) {
    return;
  }

  for (const item of source) {
    if (!isRecord(item) || typeof item.type !== "string" || !TOOL_ITEM_TYPES.has(item.type)) {
      continue;
    }

    const name = readToolName(item);

    if (name) {
      names.add(name);
    }
  }
}

function collectNestedToolNames(output: Record<string, unknown>, names: Set<string>): void {
  const choices = output.choices;

  if (Array.isArray(choices)) {
    for (const choice of choices) {
      if (isRecord(choice) && isRecord(choice.message)) {
        collectToolNames(choice.message.tool_calls, names);
      }
    }
  }

  const candidates = output.candidates;

  if (Array.isArray(candidates)) {
    for (const candidate of candidates) {
      const content = isRecord(candidate) ? candidate.content : undefined;
      const parts = isRecord(content) ? content.parts : undefined;

      if (!Array.isArray(parts)) {
        continue;
      }

      for (const part of parts) {
        if (!isRecord(part) || !isRecord(part.functionCall)) {
          continue;
        }

        const name = readStringField(part.functionCall, "name");

        if (name) {
          names.add(name);
        }
      }
    }
  }

  const result = isRecord(output.output) ? output.output.message : undefined;
  const blocks = isRecord(result) ? result.content : undefined;

  if (!Array.isArray(blocks)) {
    return;
  }

  for (const block of blocks) {
    if (!isRecord(block) || !isRecord(block.toolUse)) {
      continue;
    }

    const name = readStringField(block.toolUse, "name");

    if (name) {
      names.add(name);
    }
  }
}

export function collectAvailableToolNames(
  request: ChatCompletionParameters | undefined,
): string[] | undefined {
  if (!request) {
    return undefined;
  }

  const names = new Set<string>();
  const definitions: Array<ToolDefinitionLike | undefined> = [
    ...(request.available_functions ?? []),
    ...(request.deferred_functions ?? []),
  ];

  collectToolNames(request.tools, names);
  collectToolNames(definitions, names);

  return names.size > 0 ? [...names] : undefined;
}

export function collectCalledToolNames(output: unknown): string[] | undefined {
  if (!isRecord(output)) {
    return undefined;
  }

  const names = new Set<string>();

  collectToolNames(output.tool_calls, names);
  collectNestedToolNames(output, names);

  for (const field of TOOL_CALL_OUTPUT_FIELDS) {
    collectToolItemNames(output[field], names);
  }

  return names.size > 0 ? [...names] : undefined;
}

export function readStopReason(data: unknown): string | undefined {
  if (!isRecord(data)) {
    return undefined;
  }

  const direct =
    readStringField(data, "stop_reason") ??
    readStringField(data, "stopReason") ??
    readStringField(data, "finish_reason") ??
    readStringField(data, "finishReason");

  if (direct) {
    return direct;
  }

  for (const field of ["choices", "candidates"] as const) {
    const entries = data[field];

    if (!Array.isArray(entries)) {
      continue;
    }

    for (const entry of entries) {
      const reason = isRecord(entry)
        ? (readStringField(entry, "finish_reason") ?? readStringField(entry, "finishReason"))
        : undefined;

      if (reason) {
        return reason;
      }
    }
  }

  return undefined;
}

export function readErrorStatus(error: unknown): number | undefined {
  if (!isRecord(error)) {
    return undefined;
  }

  return readNumberField(error, "statusCode") ?? readNumberField(error, "status");
}
