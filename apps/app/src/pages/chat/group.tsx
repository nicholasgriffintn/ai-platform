import { TeammateGroupPage } from "@ngriffin_uk/polychat-component-shell";
import { getPlacePaths } from "@ngriffin_uk/polychat-library-react";
import { useParams } from "react-router";

export function meta() {
  return [{ title: "Group - Polychat" }];
}

export default function TeammateGroupRoute() {
  const { conversationId = "" } = useParams();

  return (
    <TeammateGroupPage
      conversationId={conversationId}
      backPath={getPlacePaths("chat").teammates}
      backLabel="Back to teammates"
    />
  );
}
