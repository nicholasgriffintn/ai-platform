import { ChatConversationShell, TeammateGroupPage } from "@ngriffin_uk/polychat-component-shell";
import { getPlacePaths } from "@ngriffin_uk/polychat-library-react";
import { useParams } from "react-router";

export function meta() {
  return [{ title: "Group - Polychat" }];
}

export default function TeammateGroupRoute() {
  const { conversationId = "" } = useParams();

  return (
    <ChatConversationShell title="Group">
      <TeammateGroupPage
        conversationId={conversationId}
        backPath={getPlacePaths("chat").teammates}
      />
    </ChatConversationShell>
  );
}
