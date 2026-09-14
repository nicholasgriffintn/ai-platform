import type { Message } from "@ngriffin_uk/polychat-library-chat/conversation-types";
import { ApiError, fetchSharedConversationHistory } from "@ngriffin_uk/polychat-library-client";
import { useEffect, useState } from "react";

export function useSharedConversation(shareId: string | undefined) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSharedConversation = async () => {
      if (!shareId) {
        setError("Invalid share link");
        setIsLoading(false);

        return;
      }

      try {
        setIsLoading(true);
        const data = await fetchSharedConversationHistory(shareId);

        setMessages(data.messages);
        setIsLoading(false);
      } catch (err) {
        console.error("Error fetching shared conversation:", err);
        if (err instanceof ApiError && err.status === 404) {
          setError("This shared conversation was not found or is no longer available.");
        } else if (err instanceof ApiError) {
          setError("Failed to load the shared conversation.");
        } else {
          setError("An error occurred while loading the shared conversation.");
        }

        setIsLoading(false);
      }
    };

    void fetchSharedConversation();
  }, [shareId]);

  return { messages, isLoading, error };
}
