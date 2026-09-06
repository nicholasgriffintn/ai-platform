import type { DesktopRunProgress } from "@ngriffin_uk/polychat-schemas";
import { useCallback, useRef, useState } from "react";

import type { ConnectedDesktopBackend } from "./desktop-backend";

export interface ModelRunState {
  reply: string;
  progress: DesktopRunProgress | null;
  failure: string | null;
  isRunning: boolean;
}

const IDLE: ModelRunState = { reply: "", progress: null, failure: null, isRunning: false };

export function useModelRun(backend: ConnectedDesktopBackend) {
  const [state, setState] = useState<ModelRunState>(IDLE);
  const cancelRef = useRef<(() => void) | null>(null);

  const send = useCallback(
    async (endpointId: string, nativeModelId: string, prompt: string) => {
      setState({ reply: "", progress: null, failure: null, isRunning: true });

      const run = await backend.startModelRun({
        endpointId,
        nativeModelId,
        conversationId: "desktop-scratch",
        messages: [{ role: "user", content: prompt }],
        maxOutputTokens: null,
      });

      cancelRef.current = run.cancel;

      try {
        for await (const event of run.events) {
          if (event.type === "text") {
            setState((current) => ({ ...current, reply: current.reply + event.delta }));
          }

          if (event.type === "progress") {
            setState((current) => ({ ...current, progress: event.state }));
          }

          if (event.type === "failed") {
            setState((current) => ({ ...current, failure: event.message, isRunning: false }));
          }

          if (event.type === "finished") {
            setState((current) => ({ ...current, progress: null, isRunning: false }));
          }
        }
      } finally {
        cancelRef.current = null;
        setState((current) => ({ ...current, isRunning: false }));
      }
    },
    [backend],
  );

  const cancel = useCallback(() => {
    cancelRef.current?.();
  }, []);

  return { ...state, send, cancel };
}
