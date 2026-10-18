import { ChatConversationShell, TeammateGroupPage } from "@ngriffin_uk/polychat-component-shell";
import { getPlacePaths } from "@ngriffin_uk/polychat-library-react";
import { useParams } from "react-router";

export default function DesktopTeammateGroupPage() {
  const { conversationId = "" } = useParams();
  const teammates = getPlacePaths("chat").teammates;

  return (
    <ChatConversationShell title="Group">
      <TeammateGroupPage conversationId={conversationId} backPath={teammates} />
    </ChatConversationShell>
  );
}
