import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import { safeParseJson } from "@ngriffin_uk/polychat-utility-server/json";

import { McpHttpClient } from "../mcp/McpHttpClient.js";

export const MARQUEE_MCP_URL = "https://marquee.pashi.app/mcp";

const MARQUEE_TOOLS = new Set([
  "get_shelf",
  "whats_on_tonight",
  "whats_on_this_week",
  "search_catalogue",
  "find_similar",
  "get_title",
  "titles_by_person",
  "save_to_shelf",
  "follow_person",
]);
const MARQUEE_WRITES = new Set(["save_to_shelf", "follow_person"]);

export async function executeMarqueeOperation(
  token: string,
  operation: string,
  params: Record<string, unknown>,
) {
  if (!MARQUEE_TOOLS.has(operation)) {
    throw new AssistantError("Unsupported Marquee operation", ErrorType.PARAMS_ERROR, 400);
  }

  const client = new McpHttpClient({
    url: MARQUEE_MCP_URL,
    headers: { Authorization: `Bearer ${token}` },
  });
  const result = await client.callTool(
    operation,
    MARQUEE_WRITES.has(operation) ? { ...params, confirm: true } : params,
  );
  const text = result.content
    .flatMap((part) => (part.type === "text" && part.text ? [part.text] : []))
    .join("\n");

  if (result.isError) {
    throw new AssistantError(
      text.slice(0, 300) || "Marquee could not answer",
      ErrorType.EXTERNAL_API_ERROR,
      502,
    );
  }

  return result.structuredContent ?? safeParseJson(text) ?? { text };
}
