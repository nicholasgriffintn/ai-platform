import { PageShell, SharedConversationView } from "@ngriffin_uk/polychat-component-shell";
import { ButtonLink, LoadingSpinner, PageStatus } from "@ngriffin_uk/polychat-component-ui";
import {
  ArtifactWorkbenchProvider,
  useSharedConversation,
} from "@ngriffin_uk/polychat-library-react";
import { PlusCircle } from "lucide-react";
import { useParams } from "react-router";

export function meta({ params }: { params: { share_id: string } }) {
  return [
    { title: `Shared Conversation ${params.share_id} - Polychat` },
    { name: "description", content: "Shared conversation from Polychat" },
  ];
}

export default function SharedConversationPage() {
  const { share_id } = useParams();
  const { messages, isLoading, error } = useSharedConversation(share_id);

  if (isLoading) {
    return (
      <PageShell title="Shared Conversation" bgClassName="bg-canvas" displayNavBar={false}>
        <LoadingSpinner message="Loading shared conversation..." className="py-16" />
      </PageShell>
    );
  }

  if (error) {
    return (
      <PageShell
        title="Shared Conversation Not Available"
        bgClassName="bg-canvas"
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
      bgClassName="bg-canvas"
    >
      <ArtifactWorkbenchProvider>
        <SharedConversationView messages={messages} />
      </ArtifactWorkbenchProvider>
    </PageShell>
  );
}
