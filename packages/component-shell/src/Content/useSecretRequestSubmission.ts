import type { ToolInteractionHandler } from "@ngriffin_uk/polychat-component-content";
import { submitSecretRequest } from "@ngriffin_uk/polychat-library-client";
import {
  REQUEST_SECRET_TOOL_NAME,
  type SecretRequestViewData,
} from "@ngriffin_uk/polychat-schemas";
import { useRef, useState } from "react";

export function useSecretRequestSubmission({
  request,
  conversationId,
  onToolInteraction,
}: {
  request: SecretRequestViewData;
  conversationId: string | undefined;
  onToolInteraction?: ToolInteractionHandler;
}) {
  const busy = useRef(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [settled, setSettled] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (resolve: () => Promise<string>) => {
    if (busy.current || settled || !onToolInteraction) {
      return;
    }

    busy.current = true;
    setIsSubmitting(true);
    setError(null);
    try {
      const input = await resolve();

      await onToolInteraction(REQUEST_SECRET_TOOL_NAME, "submitPrompt", {
        interactionId: request.interactionId,
        resolution: "completed",
        input,
      });
      setSettled(true);
    } catch {
      setError("The secret could not be provided. Try again.");
    } finally {
      busy.current = false;
      setIsSubmitting(false);
    }
  };

  return {
    isSubmitting,
    settled,
    error,
    available: Boolean(conversationId && onToolInteraction),
    submit: (value: string) =>
      run(async () => {
        if (!conversationId) {
          throw new Error("The conversation is not available");
        }

        const issued = await submitSecretRequest(conversationId, {
          interaction_id: request.interactionId,
          value,
        });

        return `I provided ${issued.label} privately. Use the secret reference ${issued.reference}. It works once, only in this conversation, and expires at ${issued.expires_at}.`;
      }),
    decline: () => run(async () => `I declined to provide ${request.label}.`),
  };
}
