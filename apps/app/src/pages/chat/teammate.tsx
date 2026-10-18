import { ChatConversationShell, TeammateHomePage } from "@ngriffin_uk/polychat-component-shell";
import { getPlacePaths } from "@ngriffin_uk/polychat-library-react";
import { useParams } from "react-router";

export function meta() {
  return [{ title: "Teammate - Polychat" }];
}

export default function PersonalTeammateHomePage() {
  const { teammateId = "" } = useParams();

  return (
    <ChatConversationShell title="Teammate">
      <TeammateHomePage
        teammateId={teammateId}
        teammatesPath="/chat/teammates"
        backPath={getPlacePaths("chat").teammates}
      />
    </ChatConversationShell>
  );
}
