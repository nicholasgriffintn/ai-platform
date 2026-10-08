import type { McpToolCallResult } from "./contracts.js";

export interface FormattedMcpToolResult {
  text: string;
  isError: boolean;
  truncated: boolean;
}

export function formatMcpToolResult(
  result: McpToolCallResult,
  maxChars: number,
): FormattedMcpToolResult {
  const blocks = result.content.map((block) =>
    block.type === "text" && typeof block.text === "string"
      ? block.text
      : `[${block.type} content omitted]`,
  );
  const raw =
    blocks.length > 0
      ? blocks.join("\n")
      : result.structuredContent === undefined
        ? ""
        : JSON.stringify(result.structuredContent);

  return {
    text: raw.slice(0, maxChars) || "(the tool returned no content)",
    isError: result.isError === true,
    truncated: raw.length > maxChars,
  };
}
