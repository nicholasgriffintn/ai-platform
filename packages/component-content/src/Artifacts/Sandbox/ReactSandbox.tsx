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
  const content = code.content;
  const cssContent = css?.content;
  const [prepared, setPrepared] = useState<{
    content: string;
    css: string | undefined;
    document: string;
  } | null>(null);
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

  useEffect(() => {
    let isMounted = true;

    void prepareReactArtifactDocument(content, cssContent).then((document) => {
      if (isMounted) {
        setPrepared({ content, css: cssContent, document });
      }
    });

    return () => {
      isMounted = false;
    };
  }, [content, cssContent]);

  if (!prepared || prepared.content !== content || prepared.css !== cssContent) {
    return <LoadingIndicator />;
  }

  return (
    <SandboxIframe
      documentContent={prepared.document}
      iframeKey={iframeKey}
      setPreviewError={setPreviewError}
      iframeRef={iframeRef}
    />
  );
}
