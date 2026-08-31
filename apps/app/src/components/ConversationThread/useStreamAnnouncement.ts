import { getMessageTextContent } from "@ngriffin_uk/polychat-library-chat/messages";
import { useEffect, useRef, useState } from "react";

import { truncateText } from "~/lib/utils";
import type { Message } from "~/types";

const MAX_ANNOUNCED_RESPONSE_CHARS = 1000;

export function useStreamAnnouncement({
  messages,
  isStreaming,
}: {
  messages: Message[];
  isStreaming: boolean;
}): string {
  const [announcement, setAnnouncement] = useState("");
  const wasStreamingRef = useRef(false);

  useEffect(() => {
    if (isStreaming) {
      if (!wasStreamingRef.current) {
        wasStreamingRef.current = true;
        setAnnouncement("Assistant is responding");
      }

      return;
    }

    if (!wasStreamingRef.current) {
      return;
    }

    wasStreamingRef.current = false;

    const latestAssistantMessage = messages
      .slice()
      .reverse()
      .find((message) => message.role === "assistant");
    const text = latestAssistantMessage
      ? getMessageTextContent(latestAssistantMessage)?.trim()
      : undefined;

    setAnnouncement(
      text
        ? `Response complete. ${truncateText(text, MAX_ANNOUNCED_RESPONSE_CHARS)}`
        : "Response complete",
    );
  }, [isStreaming, messages]);

  return announcement;
}
