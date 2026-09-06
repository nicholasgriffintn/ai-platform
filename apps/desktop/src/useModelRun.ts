import {
  SIGNED_OUT_ACCOUNT,
  type DesktopRunProgress,
  type DiscoveredModel,
  type LocalMessage,
} from "@ngriffin_uk/polychat-schemas";
import { useCallback, useEffect, useRef, useState } from "react";

import type { ConnectedDesktopBackend } from "./desktop-backend";

export interface ModelRunState {
  messages: LocalMessage[];
  reply: string;
  progress: DesktopRunProgress | null;
  failure: string | null;
  isRunning: boolean;
}

function conversationIdFor(model: DiscoveredModel): string {
  return `${model.endpointId}:${model.nativeId}`;
}

function newMessage(
  conversationId: string,
  role: LocalMessage["role"],
  content: string,
  status: LocalMessage["status"] = "complete",
): LocalMessage {
  return {
    id: globalThis.crypto.randomUUID(),
    conversationId,
    role,
    content,
    status,
    createdAt: new Date().toISOString(),
  };
}

export function useModelRun(backend: ConnectedDesktopBackend, model: DiscoveredModel) {
  const conversationId = conversationIdFor(model);
  const [state, setState] = useState<ModelRunState>({
    messages: [],
    reply: "",
    progress: null,
    failure: null,
    isRunning: false,
  });
  const cancelRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    let active = true;

    async function restore() {
      try {
        const messages = await backend.listMessages(conversationId);

        if (active) {
          setState((current) => ({ ...current, messages }));
        }
      } catch (cause) {
        if (active) {
          setState((current) => ({ ...current, failure: String(cause) }));
        }
      }
    }

    void restore();

    return () => {
      active = false;
    };
  }, [backend, conversationId]);

  const send = useCallback(
    async (prompt: string) => {
      const question = newMessage(conversationId, "user", prompt);

      setState((current) => ({
        ...current,
        messages: [...current.messages, question],
        reply: "",
        progress: null,
        failure: null,
        isRunning: true,
      }));

      await backend.saveConversation({
        id: conversationId,
        accountId: SIGNED_OUT_ACCOUNT,
        endpointId: model.endpointId,
        nativeModelId: model.nativeId,
        title: model.displayName,
        updatedAt: question.createdAt,
      });
      await backend.appendMessage(question);

      const run = await backend.startModelRun({
        endpointId: model.endpointId,
        nativeModelId: model.nativeId,
        conversationId,
        messages: [{ role: "user", content: prompt }],
        maxOutputTokens: null,
      });

      cancelRef.current = run.cancel;
      let answer = "";
      let ended: LocalMessage["status"] = "interrupted";

      try {
        for await (const event of run.events) {
          if (event.type === "text") {
            answer += event.delta;
            setState((current) => ({ ...current, reply: answer }));
          }

          if (event.type === "progress") {
            setState((current) => ({ ...current, progress: event.state }));
          }

          if (event.type === "failed") {
            setState((current) => ({ ...current, failure: event.message }));
          }

          if (event.type === "finished") {
            ended = event.reason === "complete" ? "complete" : "interrupted";
          }
        }
      } finally {
        cancelRef.current = null;

        if (answer.length > 0) {
          const reply = newMessage(conversationId, "assistant", answer, ended);

          await backend.appendMessage(reply);
          setState((current) => ({
            ...current,
            messages: [...current.messages, reply],
            reply: "",
          }));
        }

        setState((current) => ({ ...current, progress: null, isRunning: false }));
      }
    },
    [backend, conversationId, model],
  );

  const cancel = useCallback(() => {
    cancelRef.current?.();
  }, []);

  return { ...state, send, cancel };
}
