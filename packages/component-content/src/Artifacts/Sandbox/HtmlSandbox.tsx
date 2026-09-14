import type { ArtifactProps } from "../artifact";
import {
  HTML_SANDBOX_TEMPLATE,
  LoadingIndicator,
  SandboxIframe,
  useSandboxDocument,
} from "./shared";

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
  const { documentContent, isLoading } = useSandboxDocument({
    code,
    css,
    template: HTML_SANDBOX_TEMPLATE,
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
