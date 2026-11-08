import { buildSandboxDocument, SVG_SANDBOX_TEMPLATE } from "@ngriffin_uk/polychat-utility-core";

import type { ArtifactProps } from "../artifact";
import { SandboxIframe } from "./shared";

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
