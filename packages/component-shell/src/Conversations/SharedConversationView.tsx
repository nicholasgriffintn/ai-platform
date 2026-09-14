import { ArtifactWorkbenchPanel } from "@ngriffin_uk/polychat-component-content";
import { MessageList } from "@ngriffin_uk/polychat-component-conversation";
import { PageStatus } from "@ngriffin_uk/polychat-component-ui";
import type { Message } from "@ngriffin_uk/polychat-library-chat/conversation-types";
import { useArtifactWorkbench } from "@ngriffin_uk/polychat-library-react";
import { useEffect } from "react";

export function SharedConversationView({ messages }: { messages: Message[] }) {
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
