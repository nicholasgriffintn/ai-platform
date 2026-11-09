import {
  buildMcpAppFrameCsp,
  MCP_APP_FRAME_DOCUMENT,
} from "@ngriffin_uk/polychat-library-chat/mcp-apps";
import { mcpAppCspSchema, type McpAppCsp } from "@ngriffin_uk/polychat-schemas";
import { safeParseJson } from "@ngriffin_uk/polychat-utility-core";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { listFrameAncestors } from "~/infrastructure/http/origins";

export const MCP_APP_FRAME_PATH = "/tools/mcp_app_frames/document";

export const MCP_APP_FRAME_CLEARED_HEADERS = [
  "X-Frame-Options",
  "Permissions-Policy",
  "Cross-Origin-Embedder-Policy",
  "Cross-Origin-Opener-Policy",
  "Cross-Origin-Resource-Policy",
] as const;

function readDeclaredCsp(raw: string | undefined): McpAppCsp | undefined {
  const parsed = raw ? mcpAppCspSchema.safeParse(safeParseJson<unknown>(raw)) : null;

  return parsed?.success ? parsed.data : undefined;
}

export function isFramedRequest(fetchDestination: string | undefined): boolean {
  return fetchDestination === undefined || fetchDestination === "iframe";
}

export function renderMcpAppFrame(
  context: ServiceContext,
  rawCsp: string | undefined,
): { body: string; headers: Record<string, string> } {
  const ancestors = listFrameAncestors(context.env.ENV ?? "", context.env.APP_BASE_URL);

  return {
    body: MCP_APP_FRAME_DOCUMENT,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Security-Policy": buildMcpAppFrameCsp(readDeclaredCsp(rawCsp), ancestors),
      "Cache-Control": "no-store",
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff",
    },
  };
}
