import { TeammateWorkingContextPage } from "@ngriffin_uk/polychat-component-shell";
import { useParams } from "react-router";

export function meta() {
  return [{ title: "Teammate working context - Polychat" }];
}

export default function TeammateContextPage() {
  const { teammateId = "" } = useParams();

  return (
    <TeammateWorkingContextPage
      teammateId={teammateId}
      teammatesPath="/chat/teammates"
      backPath="/chat/teammates"
      backLabel="Back to teammates"
    />
  );
}
