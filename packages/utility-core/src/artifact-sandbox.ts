export const ARTIFACT_SCRIPT_SOURCES = {
  react: "https://cdnjs.cloudflare.com/ajax/libs/react/18.3.1/umd/react.production.min.js",
  reactDom:
    "https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.3.1/umd/react-dom.production.min.js",
  propTypes: "https://cdnjs.cloudflare.com/ajax/libs/prop-types/15.8.1/prop-types.min.js",
  recharts: "https://cdnjs.cloudflare.com/ajax/libs/recharts/2.15.0/Recharts.min.js",
} as const;

export const SVG_SANDBOX_TEMPLATE = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif;
      margin: 0;
      padding: 0;
    }
    .error-container {
      padding: 16px;
      background-color: #fff0f0;
      color: #e00;
      border-left: 4px solid #e00;
      margin: 16px;
      border-radius: 4px;
      font-family: monospace;
      white-space: pre-wrap;
    }
  </style>
</head>
<body>
  <CONTENT_PLACEHOLDER>
</body>
</html>
`;

export const HTML_SANDBOX_TEMPLATE = SVG_SANDBOX_TEMPLATE.replace(
  "</head>",
  `  <style id="css-content">
    <CSS_CODE_PLACEHOLDER>
  </style>
</head>`,
);

export function buildSandboxDocument(
  template: string,
  content: string,
  css: string | undefined = "",
): string {
  return template
    .replace("<CONTENT_PLACEHOLDER>", () => content)
    .replace("<CSS_CODE_PLACEHOLDER>", () => css);
}

const ARTIFACT_SANDBOX_CSP = [
  "default-src 'none'",
  `script-src 'unsafe-inline' ${Object.values(ARTIFACT_SCRIPT_SOURCES).join(" ")}`,
  "style-src 'unsafe-inline'",
  "img-src data: blob:",
  "font-src data:",
  "media-src data: blob:",
  "connect-src 'none'",
  "object-src 'none'",
  "frame-src 'none'",
  "worker-src 'none'",
  "form-action 'none'",
  "base-uri 'none'",
  "navigate-to 'none'",
].join("; ");

function findHeadTagEnd(documentContent: string): number {
  const lowered = documentContent.toLowerCase();
  let searchFrom = 0;

  while (searchFrom < lowered.length) {
    const start = lowered.indexOf("<head", searchFrom);

    if (start === -1) {
      return -1;
    }

    const afterName = start + "<head".length;
    const next = lowered[afterName];

    if (next === ">") {
      return afterName + 1;
    }

    if (next !== undefined && /\s/u.test(next)) {
      const close = lowered.indexOf(">", afterName);

      if (close !== -1) {
        return close + 1;
      }

      return -1;
    }

    searchFrom = afterName;
  }

  return -1;
}

export function hardenSandboxDocument(
  documentContent: string | null,
  prelude = "",
): string | undefined {
  if (!documentContent) {
    return undefined;
  }

  const policy = `<meta http-equiv="Content-Security-Policy" content="${ARTIFACT_SANDBOX_CSP}">`;
  const headEnd = findHeadTagEnd(documentContent);

  if (headEnd === -1) {
    return documentContent;
  }

  return `${documentContent.slice(0, headEnd)}${policy}${prelude}${documentContent.slice(headEnd)}`;
}

export function hardenStandaloneHtml(html: string): string | undefined {
  return hardenSandboxDocument(
    findHeadTagEnd(html) === -1
      ? `<!DOCTYPE html><html><head><meta charset="UTF-8" /></head><body style="margin:0">${html}</body></html>`
      : html,
  );
}
