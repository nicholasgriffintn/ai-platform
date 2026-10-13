import type { ArtifactProps } from "../artifact";
import { buildSandboxDocument, SandboxIframe, SVG_SANDBOX_TEMPLATE } from "./shared";

export function SvgSandbox({
  code,
  setPreviewError,
  iframeKey,
}: {
  code: ArtifactProps;
  setPreviewError: (error: string | null) => void;
  iframeKey: number;
}) {
  return (
    <SandboxIframe
      documentContent={buildSandboxDocument(SVG_SANDBOX_TEMPLATE, code.content)}
      iframeKey={iframeKey}
      setPreviewError={setPreviewError}
    />
  );
}
