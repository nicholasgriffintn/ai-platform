import { ChatConversationShell, TeammateHomePage } from "@ngriffin_uk/polychat-component-shell";
import { getPlacePaths } from "@ngriffin_uk/polychat-library-react";
import { useParams } from "react-router";

export default function DesktopTeammatePage() {
  const { teammateId = "" } = useParams();
  const teammates = getPlacePaths("chat").teammates;

  return (
    <ChatConversationShell title="Teammate">
      <TeammateHomePage teammateId={teammateId} teammatesPath={teammates} backPath={teammates} />
    </ChatConversationShell>
  );
}
