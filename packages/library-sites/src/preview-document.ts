import type { SiteProject } from "@ngriffin_uk/polychat-schemas";
import { escapeHtml, serialiseJsonForHtml } from "@ngriffin_uk/polychat-utility-core";

export interface BuildSiteFrameDocumentOptions {
  frameId: string;
  title: string;
  fontUrl: string;
  runtimeUrl: string;
  stylesheetUrl: string;
  initialProject?: SiteProject;
  initialPageId?: string;
  initialData?: Record<string, unknown>;
}

export function buildSiteFrameDocument(options: BuildSiteFrameDocumentOptions): string {
  const {
    frameId,
    title,
    fontUrl,
    runtimeUrl,
    stylesheetUrl,
    initialProject,
    initialPageId,
    initialData,
  } = options;
  const initial = initialProject
    ? `<script id="site-initial-document" type="application/json">${serialiseJsonForHtml({ project: initialProject, pageId: initialPageId ?? null, inspecting: false, selectedKey: null, data: initialData })}</script>`
    : "";

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="referrer" content="no-referrer" />
    <title>${escapeHtml(title)}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="stylesheet" href="${escapeHtml(fontUrl)}" />
    <link rel="stylesheet" href="${escapeHtml(stylesheetUrl)}" data-site-styles />
  </head>
  <body data-site-preview data-site-frame-id="${escapeHtml(frameId)}">
    <div id="site-root"></div>
    ${initial}
    <script src="${escapeHtml(runtimeUrl)}" defer></script>
  </body>
</html>`;
}
