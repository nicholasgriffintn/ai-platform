export interface BuildSiteFrameDocumentOptions {
  frameId: string;
  title: string;
  fontUrl: string;
  runtimeUrl: string;
  stylesheetUrl: string;
}

function escapeHtmlAttribute(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

export function buildSiteFrameDocument({
  frameId,
  title,
  fontUrl,
  runtimeUrl,
  stylesheetUrl,
}: BuildSiteFrameDocumentOptions): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="referrer" content="no-referrer" />
    <title>${escapeHtmlAttribute(title)}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="stylesheet" href="${escapeHtmlAttribute(fontUrl)}" />
    <link rel="stylesheet" href="${escapeHtmlAttribute(stylesheetUrl)}" data-site-styles />
  </head>
  <body data-site-preview data-site-frame-id="${escapeHtmlAttribute(frameId)}">
    <div id="site-root"></div>
    <script src="${escapeHtmlAttribute(runtimeUrl)}" defer></script>
  </body>
</html>`;
}
