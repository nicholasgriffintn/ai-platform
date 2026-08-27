import { ArtifactPanel } from "@ngriffin_uk/polychat-component-content";
import { LoadingSpinner, PageStatus } from "@ngriffin_uk/polychat-component-ui";
import { ApiError } from "@ngriffin_uk/polychat-library-client";
import { PlusCircle } from "lucide-react";

import "~/styles/scrollbar.css";
import "~/styles/github.css";
import "~/styles/github-dark.css";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";

import { MessageList } from "~/components/ConversationThread/MessageList";
import { PageShell } from "~/components/Core/PageShell";
import { useArtifactPanel } from "~/hooks/useArtifactPanel";
import { useCopyToClipboard } from "~/hooks/useCopyToClipboard";
import { fetchSharedConversationHistory } from "~/lib/api/shared-conversation";
import type { Message } from "~/types";

export function meta({ params }: { params: { share_id: string } }) {
  return [
    { title: `Shared Conversation ${params.share_id} - Polychat` },
    { name: "description", content: "Shared conversation from Polychat" },
  ];
}

export default function SharedConversationPage() {
  const { share_id } = useParams();
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const {
    currentArtifact,
    currentArtifacts,
    isPanelVisible,
    isCombinedPanel,
    openArtifact,
    closePanel,
  } = useArtifactPanel({ closeOnEscape: true });

  useEffect(() => {
    const fetchSharedConversation = async () => {
      if (!share_id) {
        setError("Invalid share link");
        setIsLoading(false);

        return;
      }

      try {
        setIsLoading(true);
        const data = await fetchSharedConversationHistory(share_id);

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
  }, [share_id]);

  const { copied: artifactCopied, copy: copyArtifact } = useCopyToClipboard();

  if (isLoading) {
    return (
      <PageShell
        className="flex h-screen w-full items-center justify-center bg-off-white dark:bg-zinc-900"
        displayNavBar={false}
      >
        <LoadingSpinner message="Loading shared conversation..." />
      </PageShell>
    );
  }

  if (error) {
    return (
      <PageShell
        title="Shared Conversation Not Available"
        className="bg-off-white dark:bg-zinc-900"
        displayNavBar={false}
      >
        <PageStatus message={error}>
          <Link
            to="/"
            className="inline-flex items-center rounded-md bg-background px-3 py-2 text-sm font-medium text-foreground hover:bg-background/90 focus:outline-none focus:ring-2 focus:ring-foreground focus:ring-offset-2"
          >
            Return Home
          </Link>
        </PageStatus>
      </PageShell>
    );
  }

  return (
    <PageShell
      title="Shared Conversation"
      headerActions={
        <Link
          to="/"
          className="no-underline inline-flex items-center gap-1 rounded-md bg-background px-3 py-2 text-sm font-medium text-foreground hover:bg-background/90 focus:outline-none focus:ring-2 focus:ring-foreground focus:ring-offset-2"
        >
          <PlusCircle size={16} />
          <span>New Chat</span>
        </Link>
      }
      displayNavBar={false}
      fullBleed
      className="flex min-h-screen flex-col bg-off-white dark:bg-zinc-900"
    >
      <div
        className={`flex h-full flex-col w-full ${isPanelVisible ? "pr-[90%] sm:pr-[350px] md:pr-[400px] lg:pr-[650px]" : ""}`}
      >
        <div className="relative flex-1 overflow-x-hidden overflow-y-scroll">
          <div className="h-full mx-auto flex w-full max-w-3xl grow flex-col gap-8 px-4">
            {messages.length > 0 ? (
              <div className="flex-1">
                <div className="mx-auto w-full max-w-3xl h-full flex flex-col gap-8 px-4">
                  <MessageList messages={messages} isSharedView onArtifactOpen={openArtifact} />
                </div>
              </div>
            ) : (
              <PageStatus message="This shared conversation has no messages." className="flex-1" />
            )}
          </div>
        </div>

        <footer className="border-t border-zinc-200 bg-off-white p-4 text-center text-sm text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400">
          This is a shared conversation from Polychat.
        </footer>
      </div>

      <ArtifactPanel
        copied={artifactCopied}
        onCopy={copyArtifact}
        artifact={currentArtifact}
        artifacts={currentArtifacts}
        onClose={closePanel}
        isVisible={isPanelVisible}
        isCombined={isCombinedPanel}
      />
    </PageShell>
  );
}
