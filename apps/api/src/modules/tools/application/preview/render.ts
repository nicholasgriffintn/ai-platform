import { generateId } from "@ngriffin_uk/polychat-utility-core";
import { getErrorMessage } from "@ngriffin_uk/polychat-utility-server/errors";
import { redactSensitiveTokens } from "@ngriffin_uk/polychat-utility-server/redaction";
import z from "zod/v4";

import { callCloudflareBrowserRendering } from "~/modules/tools/infrastructure/browser-rendering";
import type { IEnv } from "~/types";

import { buildPreviewDocument, readPreviewReport, type PreviewReport } from "./capture";

const PREVIEW_VIEWPORTS = [
  { name: "desktop", size: { width: 1280, height: 800 } },
  { name: "mobile", size: { width: 390, height: 844, isMobile: true, hasTouch: true } },
] as const;

export type PreviewViewport = (typeof PREVIEW_VIEWPORTS)[number]["name"];

export type ViewportPreview =
  | {
      viewport: PreviewViewport;
      status: "rendered";
      screenshot: string;
      report: PreviewReport;
    }
  | { viewport: PreviewViewport; status: "unavailable"; reason: string };

const BLOCKED_RESOURCE_TYPES = [
  "xhr",
  "fetch",
  "websocket",
  "eventsource",
  "prefetch",
  "ping",
  "manifest",
  "signedexchange",
  "cspviolationreport",
];

const snapshotSchema = z.object({
  screenshot: z.string().min(1),
  content: z.string(),
});

async function renderViewport(params: {
  env: IEnv;
  viewport: (typeof PREVIEW_VIEWPORTS)[number];
  html: string;
  css?: string;
  signal?: AbortSignal;
}): Promise<ViewportPreview> {
  const { env } = params;
  const viewport = params.viewport.name;

  if (!env.ACCOUNT_ID || !env.BROWSER_RENDERING_API_KEY) {
    return { viewport, status: "unavailable", reason: "Browser rendering is not configured" };
  }

  const reportId = `polychat-preview-${generateId()}`;

  try {
    const snapshot = snapshotSchema.safeParse(
      await callCloudflareBrowserRendering({
        accountId: env.ACCOUNT_ID,
        apiKey: env.BROWSER_RENDERING_API_KEY,
        path: "snapshot",
        body: {
          html: buildPreviewDocument({ html: params.html, css: params.css, reportId }),
          viewport: params.viewport.size,
          screenshotOptions: { fullPage: true },
          gotoOptions: { waitUntil: "networkidle0", timeout: 15_000 },
          rejectResourceTypes: BLOCKED_RESOURCE_TYPES,
        },
        signal: params.signal,
      }),
    );

    if (!snapshot.success) {
      return { viewport, status: "unavailable", reason: "The browser returned no snapshot" };
    }

    const report = readPreviewReport(snapshot.data.content, reportId);

    if (!report) {
      return {
        viewport,
        status: "unavailable",
        reason:
          "The page navigated away from the draft or replaced the document, so there is nothing to show. Artifacts cannot navigate.",
      };
    }

    return {
      viewport,
      status: "rendered",
      screenshot: `data:image/png;base64,${snapshot.data.screenshot}`,
      report: redactSensitiveTokens(report),
    };
  } catch (error) {
    params.signal?.throwIfAborted();

    return {
      viewport,
      status: "unavailable",
      reason: `The browser could not render the draft: ${redactSensitiveTokens(getErrorMessage(error)).slice(0, 300)}`,
    };
  }
}

export function renderHtmlPreview(params: {
  env: IEnv;
  html: string;
  css?: string;
  signal?: AbortSignal;
}): Promise<ViewportPreview[]> {
  return Promise.all(PREVIEW_VIEWPORTS.map((viewport) => renderViewport({ ...params, viewport })));
}
