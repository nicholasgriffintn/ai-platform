import type { ArtifactProps } from "./artifact";

const DOCUMENT_TYPES = new Set([
  "text/markdown",
  "text/plain",
  "application/vnd.polychat.document",
]);

const DOCUMENT_LANGUAGES = new Set(["markdown", "md", "plain", "text"]);
const INLINE_PREVIEW_TYPES = new Set(["text/html", "application/vnd.html"]);
const INLINE_PREVIEW_LANGUAGES = new Set(["html"]);
const CODE_TYPES = new Set([
  "application/mermaid",
  "application/vnd.code",
  "application/vnd.react",
  "application/vnd.mermaid",
  "image/svg+xml",
  "text/css",
  "text/html",
  "text/javascript",
  "text/jsx",
]);
const CODE_LANGUAGES = new Set([
  "css",
  "html",
  "javascript",
  "js",
  "jsx",
  "mermaid",
  "react",
  "svg",
  "ts",
  "tsx",
  "typescript",
]);

export const ARTIFACT_TYPE_EXTENSIONS: Record<string, string> = {
  "application/json": "json",
  "application/mermaid": "mmd",
  "application/vnd.code": "txt",
  "application/vnd.polychat.document": "md",
  "application/vnd.react": "tsx",
  "image/svg+xml": "svg",
  "text/css": "css",
  "text/html": "html",
  "text/javascript": "js",
  "text/jsx": "jsx",
  "text/markdown": "md",
  "text/plain": "txt",
  "text/vnd.mermaid": "mmd",
};

export const ARTIFACT_LANGUAGE_EXTENSIONS: Record<string, string> = {
  css: "css",
  html: "html",
  javascript: "js",
  js: "js",
  json: "json",
  jsx: "jsx",
  markdown: "md",
  md: "md",
  mermaid: "mmd",
  python: "py",
  react: "tsx",
  svg: "svg",
  text: "txt",
  ts: "ts",
  tsx: "tsx",
  typescript: "ts",
};

export function isDocumentArtifact(artifact: Pick<ArtifactProps, "type" | "language">): boolean {
  const type = artifact.type.toLowerCase();
  const language = artifact.language?.toLowerCase();

  if (DOCUMENT_TYPES.has(type)) {
    return true;
  }

  return language ? DOCUMENT_LANGUAGES.has(language) : false;
}

export function isInlinePreviewArtifact(
  artifact: Pick<ArtifactProps, "display" | "type" | "language">,
): boolean {
  if (artifact.display !== "inline") {
    return false;
  }

  const type = artifact.type.toLowerCase();
  const language = artifact.language?.toLowerCase();

  return (
    INLINE_PREVIEW_TYPES.has(type) || (language ? INLINE_PREVIEW_LANGUAGES.has(language) : false)
  );
}

export function isCodeArtifact(artifact: Pick<ArtifactProps, "type" | "language">): boolean {
  const type = artifact.type.toLowerCase();
  const language = artifact.language?.toLowerCase();

  return CODE_TYPES.has(type) || (language ? CODE_LANGUAGES.has(language) : false);
}

export function isStylesheetArtifact(artifact: Pick<ArtifactProps, "type" | "language">): boolean {
  const type = artifact.type.toLowerCase();
  const language = artifact.language?.toLowerCase();

  return type === "text/css" || language === "css";
}

export function canCombineArtifacts(
  artifacts: Array<Pick<ArtifactProps, "type" | "language">>,
): boolean {
  if (artifacts.length < 2) {
    return false;
  }

  const hasScript = artifacts.some((artifact) => {
    const type = artifact.type.toLowerCase();
    const language = artifact.language?.toLowerCase();

    return (
      type === "text/javascript" ||
      type === "text/jsx" ||
      type === "application/vnd.react" ||
      language === "javascript" ||
      language === "js" ||
      language === "jsx" ||
      language === "react" ||
      language === "tsx" ||
      language === "typescript" ||
      language === "ts"
    );
  });

  const hasStylesheet = artifacts.some((artifact) => isStylesheetArtifact(artifact));

  return hasScript && hasStylesheet;
}
