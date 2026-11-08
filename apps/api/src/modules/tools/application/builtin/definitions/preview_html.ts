import z from "zod/v4";

import type { FunctionToolDescriptor } from "~/types/functions";

export const PREVIEW_HTML_TOOL_NAME = "preview_html";

export const previewHtmlInputSchema = z.object({
  html: z
    .string()
    .min(1)
    .max(400_000)
    .describe("The draft HTML or SVG exactly as it will appear in the artifact."),
  css: z
    .string()
    .max(100_000)
    .optional()
    .describe("Separate CSS for the artifact, when it has a CSS part."),
});

export const preview_html: FunctionToolDescriptor = {
  name: PREVIEW_HTML_TOOL_NAME,
  description:
    "Render a draft HTML or SVG artifact in an isolated headless browser, under the same sandbox rules as the artifact viewer, and get back desktop and mobile screenshots, content size, console errors and warnings, page errors and blocked or failed requests. Call it once after writing or materially changing an HTML or SVG artifact and before presenting it; fix what it reports, then present. It renders draft markup only and never loads URLs.",
  type: "premium",
  permissions: ["read"],
  effects: { effectClass: "read" },
  maxCallsPerTurn: 3,
  requiredEnv: ["ACCOUNT_ID", "BROWSER_RENDERING_API_KEY"],
  inputSchema: previewHtmlInputSchema,
};
