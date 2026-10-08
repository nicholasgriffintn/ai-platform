import { extractArtifactBindings } from "@ngriffin_uk/polychat-library-chat/artifact-bindings";
import { useEffect, useMemo, useRef, useState } from "react";

import type { ArtifactProps } from "../artifact";
import { useArtifactBindingBridge } from "./artifactBindingBridge";
import { buildReactArtifactDocument } from "./reactArtifactDocument";
import { LoadingIndicator, SandboxIframe } from "./shared";
import { importsRecharts, transformReactArtifact } from "./transformReactArtifact";

function compileFailureScript(message: string): string {
  return `throw new Error(${JSON.stringify(message)});`;
}

export async function prepareReactArtifactDocument(
  content: string,
  css: string | undefined,
): Promise<string> {
  const { code, error } = extractArtifactBindings(content);

  if (error) {
    return buildReactArtifactDocument({
      transpiledCode: compileFailureScript(error),
      css,
      usesRecharts: false,
    });
  }

  try {
    return buildReactArtifactDocument({
      transpiledCode: await transformReactArtifact(code),
      css,
      usesRecharts: importsRecharts(code),
    });
  } catch (transformError) {
    return buildReactArtifactDocument({
      transpiledCode: compileFailureScript(
        transformError instanceof Error
          ? `The component could not be compiled: ${transformError.message}`
          : "The component could not be compiled.",
      ),
      css,
      usesRecharts: false,
    });
  }
}

export function ReactSandbox({
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
  const [documentContent, setDocumentContent] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [prevCode, setPrevCode] = useState(code);
  const [prevCss, setPrevCss] = useState(css);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const conversationId = code.source?.conversationId;
  const messageId = code.source?.messageId;
  const bindingSource = useMemo(
    () =>
      conversationId && messageId
        ? { conversationId, messageId, artifactIdentifier: code.identifier }
        : undefined,
    [code.identifier, conversationId, messageId],
  );

  useArtifactBindingBridge(iframeRef, bindingSource);

  if (prevCode !== code || prevCss !== css) {
    setPrevCode(code);
    setPrevCss(css);
    setIsLoading(true);
  }

  useEffect(() => {
    let isMounted = true;

    void prepareReactArtifactDocument(code.content, css?.content).then((doc) => {
      if (isMounted) {
        setDocumentContent(doc);
        setIsLoading(false);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [code, css]);

  if (isLoading) {
    return <LoadingIndicator />;
  }

  return (
    <SandboxIframe
      documentContent={documentContent}
      iframeKey={iframeKey}
      setPreviewError={setPreviewError}
      iframeRef={iframeRef}
    />
  );
}
