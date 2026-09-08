import { Button, cn } from "@ngriffin_uk/polychat-component-ui";
import type { ChatRequestOptions } from "@ngriffin_uk/polychat-library-chat/conversation-types";
import {
  useConversationRetention,
  useConversationStorage,
} from "@ngriffin_uk/polychat-library-react";
import { CloudUpload, Ghost } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface ConversationRetentionControlProps {
  conversationId?: string;
  isLocalOnly?: boolean;
  requestOptions?: ChatRequestOptions;
}

const TEMPORARY_HINT = "Temporary chat: stays on this device and is never saved to Polychat";
const KEPT_HINT = "Kept chat: saved to your Polychat account";

export function ConversationRetentionControl({
  conversationId,
  isLocalOnly = false,
  requestOptions,
}: ConversationRetentionControlProps) {
  const { keepConversation } = useConversationStorage(requestOptions);
  const { mode, isLocked, toggle } = useConversationRetention(requestOptions);
  const [isKeeping, setIsKeeping] = useState(false);

  if (isLocked) {
    return null;
  }

  if (conversationId && isLocalOnly) {
    const label = "Keep this chat — uploads the transcript to your account";

    const handleKeep = async () => {
      setIsKeeping(true);

      try {
        await keepConversation(conversationId);
      } catch (error) {
        console.error("Failed to keep conversation:", error);
        toast.error("Unable to keep this chat");
      } finally {
        setIsKeeping(false);
      }
    };

    return (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        icon={<CloudUpload size={15} />}
        title={label}
        aria-label={label}
        disabled={isKeeping}
        onClick={() => void handleKeep()}
      >
        Keep this chat
      </Button>
    );
  }

  if (conversationId) {
    return null;
  }

  const isTemporary = mode.retention === "temporary";
  const hint = isTemporary ? TEMPORARY_HINT : KEPT_HINT;

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      aria-pressed={isTemporary}
      title={`${hint} (⌘⇧T)`}
      aria-label={isTemporary ? "Make this chat kept" : "Make this chat temporary"}
      icon={<Ghost size={15} className={cn(isTemporary && "text-active-work")} />}
      className={cn(isTemporary && "bg-active-work/10 text-foreground")}
      onClick={toggle}
    />
  );
}
