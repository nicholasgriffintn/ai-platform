import z from "zod/v4";

import type { FunctionToolDescriptor } from "~/types/functions";

export const PREVIEW_HTML_TOOL_NAME = "preview_html";

export const previewHtmlInputSchema = z.object({
  html: z.string().min(1).max(400_000).describe("Draft artifact markup."),
  css: z.string().max(100_000).optional().describe("The artifact's CSS part, if any."),
});

export const preview_html: FunctionToolDescriptor = {
  name: PREVIEW_HTML_TOOL_NAME,
  description:
    "Render a draft HTML or SVG artifact in the artifact sandbox; returns desktop and mobile screenshots, console and page errors, and blocked requests. Call once before presenting a new or materially changed one, then fix what it reports.",
  type: "premium",
  permissions: ["read"],
  effects: { effectClass: "read" },
  maxCallsPerTurn: 3,
  requiredEnv: ["ACCOUNT_ID", "BROWSER_RENDERING_API_KEY"],
  inputSchema: previewHtmlInputSchema,
};
