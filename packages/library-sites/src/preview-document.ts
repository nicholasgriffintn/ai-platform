import { escapeHtml } from "@ngriffin_uk/polychat-utility-core";

export interface BuildSiteFrameDocumentOptions {
  frameId: string;
  title: string;
  fontUrl: string;
  runtimeUrl: string;
  stylesheetUrl: string;
  runtimeFailureMessage?: unknown;
  inlineAssets?: SiteFrameInlineAssets | null;
}

export interface SiteFrameInlineAssets {
  runtime: string;
  stylesheet: string;
}

function inlineScript(source: string): string {
  return source.replace(/<\/(script)/gi, "<\\/$1").replace(/<!--/g, "<\\!--");
}

function inlineStyle(source: string): string {
  return source.replace(/<\/(style)/gi, "<\\/$1");
}

export function buildSiteFrameDocument(options: BuildSiteFrameDocumentOptions): string {
  const { frameId, title, fontUrl, runtimeUrl, stylesheetUrl, inlineAssets } = options;
  const onError = options.runtimeFailureMessage
    ? ` onerror="${escapeHtml(`parent.postMessage(${JSON.stringify(options.runtimeFailureMessage)}, "*")`)}"`
    : "";
  const styles = inlineAssets
    ? `<style data-site-styles>${inlineStyle(inlineAssets.stylesheet)}</style>`
    : `<link rel="stylesheet" href="${escapeHtml(stylesheetUrl)}" data-site-styles />`;
  const runtime = inlineAssets
    ? `<script>${inlineScript(inlineAssets.runtime)}</script>`
    : `<script src="${escapeHtml(runtimeUrl)}" defer${onError}></script>`;

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="referrer" content="no-referrer" />
    <title>${escapeHtml(title)}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="stylesheet" href="${escapeHtml(fontUrl)}" />
    ${styles}
  </head>
  <body data-site-preview data-site-frame-id="${escapeHtml(frameId)}">
    <div id="site-root"></div>
    ${runtime}
  </body>
</html>`;
}
