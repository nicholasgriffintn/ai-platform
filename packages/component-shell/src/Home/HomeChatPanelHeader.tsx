import { Button } from "@ngriffin_uk/polychat-component-ui";
import { getPersonalConversationPath, useChat } from "@ngriffin_uk/polychat-library-react";
import { Maximize2, X } from "lucide-react";
import { useNavigate } from "react-router";

export function HomeChatPanelHeader({
  conversationId,
  onClose,
}: {
  conversationId: string;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const { data: conversation } = useChat(conversationId);

  return (
    <header className="flex shrink-0 items-center gap-2 border-b border-border px-3 py-2">
      <div className="min-w-0 flex-1">
        <p className="polychat-eyebrow">Chat</p>
        <p className="truncate text-sm font-medium text-foreground">
          {conversation?.title?.trim() || "New conversation"}
        </p>
      </div>
      <Button
        variant="icon"
        size="icon"
        aria-label="Open in Chat"
        title="Open in Chat"
        onClick={() => void navigate(getPersonalConversationPath(conversationId))}
      >
        <Maximize2 size={16} aria-hidden />
      </Button>
      <Button variant="icon" size="icon" aria-label="Close chat" title="Close" onClick={onClose}>
        <X size={16} aria-hidden />
      </Button>
    </header>
  );
}
