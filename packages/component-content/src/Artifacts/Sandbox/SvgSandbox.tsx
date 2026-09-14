import type { ArtifactProps } from "../artifact";
import {
  LoadingIndicator,
  SandboxIframe,
  SVG_SANDBOX_TEMPLATE,
  useSandboxDocument,
} from "./shared";

export function SvgSandbox({
  code,
  setPreviewError,
  iframeKey,
}: {
  code: ArtifactProps;
  setPreviewError: (error: string | null) => void;
  iframeKey: number;
}) {
  const { documentContent, isLoading } = useSandboxDocument({
    code,
    template: SVG_SANDBOX_TEMPLATE,
  });

  if (isLoading) {
    return <LoadingIndicator />;
  }

  return (
    <SandboxIframe
      documentContent={documentContent}
      iframeKey={iframeKey}
      setPreviewError={setPreviewError}
    />
  );
}
