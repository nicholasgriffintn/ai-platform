import type { ToolInteractionHandler } from "@ngriffin_uk/polychat-component-content";
import type { BrowserSession, BrowserSessionViewData } from "@ngriffin_uk/polychat-schemas";
import { useRef, useState } from "react";

export function useBrowserSessionContinuation({
  request,
  onToolInteraction,
  status,
  closed,
}: {
  request: BrowserSessionViewData;
  onToolInteraction?: ToolInteractionHandler;
  status?: BrowserSession["status"];
  closed: boolean;
}) {
  const busy = useRef(false);
  const [isReturning, setIsReturning] = useState(false);
  const [returned, setReturned] = useState(false);
  const [returnError, setReturnError] = useState(false);
  const continueChat = async () => {
    if (!request.humanInTheLoop || !onToolInteraction || busy.current || returned) {
      return;
    }

    busy.current = true;
    setIsReturning(true);
    setReturnError(false);
    try {
      await onToolInteraction("use_computer", "submitPrompt", {
        input: closed
          ? "The browser was closed. Continue without it."
          : `The browser task is ${status}. Inspect browser session ${request.sessionId} to retrieve its result and continue.`,
        interactionId: request.humanInTheLoop.interactionId,
        resolution: "completed",
      });
      setReturned(true);
    } catch {
      setReturnError(true);
    } finally {
      busy.current = false;
      setIsReturning(false);
    }
  };

  return { isReturning, returned, returnError, continueChat };
}
