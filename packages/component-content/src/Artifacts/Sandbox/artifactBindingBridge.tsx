import type { ArtifactBindingArgs } from "@ngriffin_uk/polychat-schemas";
import { isRecord } from "@ngriffin_uk/polychat-utility-core";
import { createContext, type ReactNode, type RefObject, useContext, useEffect } from "react";

export interface ArtifactBindingSource {
  conversationId: string;
  messageId: string;
  artifactIdentifier: string;
}

export type ArtifactBindingReader = (
  request: ArtifactBindingSource & { bindingId: string; args: ArtifactBindingArgs },
) => Promise<unknown>;

const ArtifactBindingReaderContext = createContext<ArtifactBindingReader | null>(null);

export function ArtifactBindingReaderProvider({
  reader,
  children,
}: {
  reader: ArtifactBindingReader;
  children: ReactNode;
}) {
  return (
    <ArtifactBindingReaderContext.Provider value={reader}>
      {children}
    </ArtifactBindingReaderContext.Provider>
  );
}

function readBindingArgs(value: unknown): ArtifactBindingArgs {
  if (!isRecord(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value).filter(
      (entry): entry is [string, string | number | boolean | null] =>
        entry[1] === null || ["string", "number", "boolean"].includes(typeof entry[1]),
    ),
  );
}

function errorMessage(error: unknown): string {
  return error instanceof Error && error.message ? error.message : "The data could not be loaded.";
}

const UNAVAILABLE_MESSAGE =
  "Live data is only available in the conversation where this artifact was made.";

export function useArtifactBindingBridge(
  iframeRef: RefObject<HTMLIFrameElement | null>,
  source: ArtifactBindingSource | undefined,
) {
  const reader = useContext(ArtifactBindingReaderContext);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const frame = iframeRef.current?.contentWindow;
      const message: unknown = event.data;

      if (
        !frame ||
        event.source !== frame ||
        !isRecord(message) ||
        message.type !== "polychat:binding-read" ||
        typeof message.requestId !== "number" ||
        typeof message.bindingId !== "string"
      ) {
        return;
      }

      const reply = (result: { ok: true; data: unknown } | { ok: false; error: string }) =>
        frame.postMessage(
          { type: "polychat:binding-result", requestId: message.requestId, ...result },
          "*",
        );

      if (!reader || !source) {
        reply({ ok: false, error: UNAVAILABLE_MESSAGE });

        return;
      }

      reader({ ...source, bindingId: message.bindingId, args: readBindingArgs(message.args) }).then(
        (data) => reply({ ok: true, data }),
        (error: unknown) => reply({ ok: false, error: errorMessage(error) }),
      );
    };

    window.addEventListener("message", handleMessage);

    return () => window.removeEventListener("message", handleMessage);
  }, [iframeRef, reader, source]);
}
