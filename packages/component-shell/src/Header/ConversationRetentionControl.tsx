import { Button } from "@ngriffin_uk/polychat-component-ui";
import { useConversationStorage } from "@ngriffin_uk/polychat-library-react";
import { CloudUpload } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export function ConversationRetentionControl({ conversationId }: { conversationId: string }) {
  const { keepConversation } = useConversationStorage();
  const [isKeeping, setIsKeeping] = useState(false);
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
