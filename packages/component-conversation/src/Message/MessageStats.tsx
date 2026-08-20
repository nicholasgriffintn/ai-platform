import { cn } from "@ngriffin_uk/polychat-component-ui";
import type { Message } from "@ngriffin_uk/polychat-library-chat/conversation-types";
import { getMessageStatsSegments } from "@ngriffin_uk/polychat-library-chat/response-stats";

interface MessageStatsProps {
  message: Message;
  responseDurationMs?: number;
  className?: string;
}

export function MessageStats({ message, responseDurationMs, className }: MessageStatsProps) {
  if (message.role !== "assistant") {
    return null;
  }

  const segments = getMessageStatsSegments(message, responseDurationMs);

  if (segments.length === 0) {
    return null;
  }

  return (
    <span
      className={cn("text-xs text-zinc-500 tabular-nums dark:text-zinc-500", className)}
      data-testid="message-stats"
    >
      {segments.join(" · ")}
    </span>
  );
}
