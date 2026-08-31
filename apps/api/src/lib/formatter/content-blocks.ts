import { isRecord } from "~/utils/objects";

export interface ReasoningContentBlocks {
  text: string;
  thinking: string;
}

function collectText(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(collectText).join("");
  }

  if (!isRecord(value)) {
    return "";
  }

  return typeof value.text === "string" ? value.text : "";
}

export function extractReasoningContentBlocks(content: unknown): ReasoningContentBlocks {
  if (!Array.isArray(content)) {
    return {
      text: typeof content === "string" ? content : "",
      thinking: "",
    };
  }

  let text = "";
  let thinking = "";

  for (const block of content) {
    if (typeof block === "string") {
      text += block;
      continue;
    }

    if (!isRecord(block)) {
      continue;
    }

    if (block.type === "text") {
      text += collectText(block);
    } else if (block.type === "thinking") {
      thinking += collectText(block.thinking);
    }
  }

  return { text, thinking };
}
