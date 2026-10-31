import { Button } from "@ngriffin_uk/polychat-component-ui";
import { getPersonalConversationPath, useChat } from "@ngriffin_uk/polychat-library-react";
import { ArrowLeft, Maximize2, MessageCircle, X } from "lucide-react";
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
    <header className="flex h-13 shrink-0 items-center gap-1 border-b border-border pr-3 pl-3 lg:pl-5">
      <Button
        variant="icon"
        size="sm"
        aria-label="Back to Discover"
        className="lg:hidden"
        icon={<ArrowLeft size={16} aria-hidden />}
        onClick={onClose}
      />
      <MessageCircle
        size={15}
        className="hidden shrink-0 text-muted-foreground lg:block"
        aria-hidden
      />
      <p className="polychat-eyebrow ml-1.5 shrink-0">Chat</p>
      <p className="ml-2 min-w-0 flex-1 truncate text-sm text-foreground">
        {conversation?.title?.trim() || "New conversation"}
      </p>
      <Button
        variant="icon"
        size="sm"
        aria-label="Open as a page"
        title="Open as a page"
        icon={<Maximize2 size={15} aria-hidden />}
        onClick={() => void navigate(getPersonalConversationPath(conversationId))}
      />
      <Button
        variant="icon"
        size="sm"
        aria-label="Close chat"
        title="Close"
        className="hidden lg:inline-flex"
        icon={<X size={16} aria-hidden />}
        onClick={onClose}
      />
    </header>
  );
}
