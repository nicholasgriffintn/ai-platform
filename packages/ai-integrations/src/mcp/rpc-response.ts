import { safeParseJson } from "@ngriffin_uk/polychat-utility-server/json";

import { jsonRpcResponseSchema, type JsonRpcResponse } from "./contracts.js";

function readEventStreamMessages(body: string): unknown[] {
  return body.split(/\r?\n\r?\n/).flatMap((block) => {
    const data = block
      .split(/\r?\n/)
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trimStart())
      .join("\n");

    return data ? [safeParseJson(data)] : [];
  });
}

export function readJsonRpcResponse(
  body: string,
  contentType: string | null,
  id: number,
): JsonRpcResponse | null {
  const candidates = contentType?.includes("text/event-stream")
    ? readEventStreamMessages(body)
    : [safeParseJson(body)];

  for (const candidate of candidates.flat()) {
    const parsed = jsonRpcResponseSchema.safeParse(candidate);

    if (parsed.success && parsed.data.id === id) {
      return parsed.data;
    }
  }

  return null;
}
