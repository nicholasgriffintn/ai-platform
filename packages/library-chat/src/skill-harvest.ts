import { isRecord, safeParseJson } from "@ngriffin_uk/polychat-utility-core";

import { readMessageReactions } from "./reactions.js";

export const SKILL_HARVEST_MIN_TOOL_CALLS = 5;

const MAX_STEPS = 40;
const MAX_TEXT_CHARS = 1_200;

export interface HarvestableMessage {
  role?: unknown;
  name?: unknown;
  status?: unknown;
  content?: unknown;
  data?: unknown;
  tool_call_arguments?: unknown;
}

export interface SkillHarvestTrace {
  request: string;
  steps: { tool: string; argumentNames: string[] }[];
  outcome: string;
}

function readText(content: unknown): string {
  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => (part && typeof part === "object" && "text" in part ? String(part.text) : ""))
      .filter(Boolean)
      .join("\n");
  }

  return "";
}

function clip(text: string): string {
  const compact = text.replace(/\s+/g, " ").trim();

  return compact.length > MAX_TEXT_CHARS ? `${compact.slice(0, MAX_TEXT_CHARS)}…` : compact;
}

function argumentNames(rawArguments: unknown): string[] {
  const parsed =
    typeof rawArguments === "string" ? safeParseJson<unknown>(rawArguments) : rawArguments;

  return isRecord(parsed) ? Object.keys(parsed).slice(0, 12) : [];
}

export function wasThumbedDown(messages: readonly HarvestableMessage[]): boolean {
  return messages.some(
    (message) =>
      message.role === "assistant" &&
      readMessageReactions(message.data).some(
        (reaction) => reaction.actor === "person" && reaction.emoji === "👎",
      ),
  );
}

export function buildSkillHarvestTrace(
  messages: readonly HarvestableMessage[],
): SkillHarvestTrace | null {
  const request = messages.find((message) => message.role === "user");
  const steps = messages.flatMap((message) =>
    message.role === "tool" && message.status === "success" && typeof message.name === "string"
      ? [{ tool: message.name, argumentNames: argumentNames(message.tool_call_arguments) }]
      : [],
  );
  const outcome = [...messages].reverse().find((message) => message.role === "assistant");

  if (!request || !outcome || steps.length < SKILL_HARVEST_MIN_TOOL_CALLS) {
    return null;
  }

  return {
    request: clip(readText(request.content)),
    steps: steps.slice(0, MAX_STEPS),
    outcome: clip(readText(outcome.content)),
  };
}

export function describeSkillHarvestTrace(trace: SkillHarvestTrace): string {
  const steps = trace.steps
    .map(
      (step, index) =>
        `${index + 1}. ${step.tool}${
          step.argumentNames.length > 0 ? ` (${step.argumentNames.join(", ")})` : ""
        }`,
    )
    .join("\n");

  return `Request:\n${trace.request}\n\nTool calls, in order:\n${steps}\n\nFinal reply:\n${trace.outcome}`;
}
