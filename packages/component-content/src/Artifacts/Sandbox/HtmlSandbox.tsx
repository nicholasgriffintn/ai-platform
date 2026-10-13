import type { ArtifactProps } from "../artifact";
import { buildSandboxDocument, HTML_SANDBOX_TEMPLATE, SandboxIframe } from "./shared";

export function HtmlSandbox({
  code,
  css,
  setPreviewError,
  iframeKey,
}: {
  code: ArtifactProps;
  css?: ArtifactProps;
  setPreviewError: (error: string | null) => void;
  iframeKey: number;
}) {
  return (
    <SandboxIframe
      documentContent={buildSandboxDocument(HTML_SANDBOX_TEMPLATE, code.content, css?.content)}
      iframeKey={iframeKey}
      setPreviewError={setPreviewError}
    />
  );
}
