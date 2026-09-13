import { ArtifactWorkbenchPanel } from "@ngriffin_uk/polychat-component-content";
import { MessageList } from "@ngriffin_uk/polychat-component-conversation";
import { PageShell } from "@ngriffin_uk/polychat-component-shell";
import { ButtonLink, LoadingSpinner, PageStatus } from "@ngriffin_uk/polychat-component-ui";
import type { Message } from "@ngriffin_uk/polychat-library-chat/conversation-types";
import { ApiError, fetchSharedConversationHistory } from "@ngriffin_uk/polychat-library-client";
import {
  ArtifactWorkbenchProvider,
  useArtifactWorkbench,
} from "@ngriffin_uk/polychat-library-react";
import { PlusCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { useParams } from "react-router";
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

  if (isLoading) {
    return (
      <PageShell
        className="flex h-screen w-full items-center justify-center bg-canvas"
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
        className="bg-canvas"
        displayNavBar={false}
      >
        <PageStatus message={error}>
          <ButtonLink variant="outline" href="/">
            Return Home
          </ButtonLink>
        </PageStatus>
      </PageShell>
    );
  }

  return (
    <PageShell
      title="Shared Conversation"
      headerActions={
        <ButtonLink variant="outline" size="sm" href="/" icon={<PlusCircle size={16} />}>
          New Chat
        </ButtonLink>
      }
      displayNavBar={false}
      fullBleed
      className="flex min-h-screen flex-col bg-canvas"
    >
      <ArtifactWorkbenchProvider>
        <SharedConversationView messages={messages} />
      </ArtifactWorkbenchProvider>
    </PageShell>
  );
}

function SharedConversationView({ messages }: { messages: Message[] }) {
  const {
    currentArtifact,
    currentArtifacts,
    isPanelVisible,
    isCombinedPanel,
    openArtifact,
    closePanel,
    copied,
    copyArtifact,
  } = useArtifactWorkbench();
  const hasArtifact = isPanelVisible && currentArtifact !== null;

  useEffect(() => {
    if (!hasArtifact) {
      return undefined;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closePanel();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [closePanel, hasArtifact]);

  return (
    <div className="flex h-full min-h-0 w-full flex-1">
      <div className="flex h-full w-full min-w-0 flex-1 flex-col">
        <div className="relative flex-1 overflow-x-hidden overflow-y-scroll">
          <div className="mx-auto flex h-full w-full max-w-3xl grow flex-col gap-8 px-4">
            {messages.length > 0 ? (
              <div className="flex-1">
                <div className="mx-auto flex h-full w-full max-w-3xl flex-col gap-8 px-4">
                  <MessageList messages={messages} isSharedView onArtifactOpen={openArtifact} />
                </div>
              </div>
            ) : (
              <PageStatus message="This shared conversation has no messages." className="flex-1" />
            )}
          </div>
        </div>

        <footer className="border-t border-border bg-surface p-4 text-center text-sm text-muted-foreground">
          This is a shared conversation from Polychat.
        </footer>
      </div>

      {hasArtifact ? (
        <aside
          aria-label="Artifact"
          className="h-full w-full shrink-0 border-l border-border bg-surface sm:w-[350px] md:w-[400px] lg:w-[650px]"
        >
          <ArtifactWorkbenchPanel
            artifact={currentArtifact}
            artifacts={currentArtifacts}
            isCombined={isCombinedPanel}
            copied={copied}
            onCopy={copyArtifact}
            onClose={closePanel}
          />
        </aside>
      ) : null}
    </div>
  );
}
