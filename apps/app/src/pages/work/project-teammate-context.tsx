import { TeammateWorkingContextPage } from "@ngriffin_uk/polychat-component-shell";
import { useParams } from "react-router";

export function meta() {
  return [{ title: "Project teammate working context - Polychat" }];
}

export default function ProjectTeammateContextPage() {
  const { workspaceId = "", projectId = "", teammateId = "" } = useParams();
  const teammatesPath = `/work/${workspaceId}/projects/${projectId}/teammates`;

  return (
    <TeammateWorkingContextPage
      teammateId={teammateId}
      teammatesPath={teammatesPath}
      backPath={teammatesPath}
      backLabel="Back to teammates"
      projectId={projectId}
    />
  );
}
