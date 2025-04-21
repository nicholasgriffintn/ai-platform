import { MessagesSquare, PlusCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";

import "~/styles/scrollbar.css";
import "~/styles/github.css";
import "~/styles/github-dark.css";
import { ArtifactPanel } from "~/components/ConversationThread/Artifacts/ArtifactPanel";
import { MessageList } from "~/components/ConversationThread/MessageList";
import { LoadingSpinner } from "~/components/LoadingSpinner";
import { API_BASE_URL } from "~/constants";
import type { Message } from "~/types";
import type { ArtifactProps } from "~/types/artifact";

export function meta() {
  return [
    { title: "Shared Conversation - Polychat" },
    { name: "description", content: "Shared conversation from Polychat" },
  ];
}

export default function SharedConversationPage() {
  const { share_id } = useParams();
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentArtifact, setCurrentArtifact] = useState<ArtifactProps | null>(
    null,
  );
  const [isPanelVisible, setIsPanelVisible] = useState(false);
  const [currentArtifacts, setCurrentArtifacts] = useState<ArtifactProps[]>([]);
  const [isCombinedPanel, setIsCombinedPanel] = useState(false);

  useEffect(() => {
    const fetchSharedConversation = async () => {
      if (!share_id) {
        setError("Invalid share link");
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        const response = await fetch(`${API_BASE_URL}/chat/shared/${share_id}`);

        if (!response.ok) {
          if (response.status === 404) {
            setError(
              "This shared conversation was not found or is no longer available.",
            );
          } else {
            setError("Failed to load the shared conversation.");
          }
          setIsLoading(false);
          return;
        }

        const data = (await response.json()) as {
          messages: Message[];
          share_id: string;
        };
        setMessages(data.messages);
        setIsLoading(false);
      } catch (err) {
        console.error("Error fetching shared conversation:", err);
        setError("An error occurred while loading the shared conversation.");
        setIsLoading(false);
      }
    };

    fetchSharedConversation();
  }, [share_id]);

  const handleArtifactOpen = (
    artifact: ArtifactProps,
    combine?: boolean,
    artifacts?: ArtifactProps[],
  ) => {
    setCurrentArtifact(artifact);
    setIsPanelVisible(true);

    if (combine && artifacts && artifacts.length > 1) {
      setCurrentArtifacts(artifacts);
      setIsCombinedPanel(true);
      return;
    }
  };

  const handlePanelClose = () => {
    setIsPanelVisible(false);
    setIsCombinedPanel(false);

    setTimeout(() => {
      setCurrentArtifact(null);
      setCurrentArtifacts([]);
    }, 300);
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: prevent memory leak
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isPanelVisible) {
        handlePanelClose();
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => {
      window.removeEventListener("keydown", handleKeyPress);
    };
  }, [isPanelVisible]);

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-off-white dark:bg-zinc-900">
        <LoadingSpinner message="Loading shared conversation..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-off-white dark:bg-zinc-900">
        <div className="mx-auto max-w-md rounded-lg border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <h1 className="mb-4 text-xl font-semibold text-zinc-900 dark:text-zinc-100">
            Shared Conversation Not Available
          </h1>
          <p className="mb-8 text-zinc-600 dark:text-zinc-400">{error}</p>
          <Link
            to="/"
            className="inline-flex items-center rounded-md bg-background px-3 py-2 text-sm font-medium text-foreground hover:bg-background/90 focus:outline-none focus:ring-2 focus:ring-foreground focus:ring-offset-2"
          >
            Return Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-off-white dark:bg-zinc-900">
      <div
        className={`flex flex-col h-[calc(100vh)] w-full ${isPanelVisible ? "pr-[90%] sm:pr-[350px] md:pr-[400px] lg:pr-[650px]" : ""}`}
      >
        <header className="sticky top-0 z-10 border-b border-zinc-200 bg-off-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
          <div className="mx-auto flex max-w-3xl items-center justify-between">
            <div className="flex items-center">
              <MessagesSquare
                size={20}
                className="mr-2 text-zinc-600 dark:text-zinc-400"
              />
              <h1 className="text-lg font-semibold text-zinc-800 dark:text-zinc-200">
                Shared Conversation
              </h1>
            </div>
            <div className="flex items-center gap-2">
              <Link
                to="/"
                className="no-underline inline-flex items-center gap-1 rounded-md bg-background px-3 py-2 text-sm font-medium text-foreground hover:bg-background/90 focus:outline-none focus:ring-2 focus:ring-foreground focus:ring-offset-2"
              >
                <PlusCircle size={16} />
                <span>New Chat</span>
              </Link>
            </div>
          </div>
        </header>

        <div className="relative flex-1 overflow-x-hidden overflow-y-scroll">
          <div className="h-full mx-auto flex w-full max-w-3xl grow flex-col gap-8 px-4">
            {messages.length > 0 ? (
              <div className="flex-1">
                <div className="mx-auto w-full max-w-3xl h-full flex flex-col gap-8 px-4">
                  <MessageList
                    messages={messages}
                    isSharedView={true}
                    onArtifactOpen={handleArtifactOpen}
                  />
                </div>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center rounded-lg border border-zinc-200 bg-white p-8 dark:border-zinc-800 dark:bg-zinc-950">
                <p className="text-center text-zinc-600 dark:text-zinc-400">
                  This shared conversation has no messages.
                </p>
              </div>
            )}
          </div>
        </div>

        <footer className="border-t border-zinc-200 bg-off-white p-4 text-center text-sm text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400">
          This is a shared conversation from Polychat.
        </footer>
      </div>

      <ArtifactPanel
        artifact={currentArtifact}
        artifacts={currentArtifacts}
        onClose={handlePanelClose}
        isVisible={isPanelVisible}
        isCombined={isCombinedPanel}
      />
    </div>
  );
}
