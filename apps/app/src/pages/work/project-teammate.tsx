import { TeammateHomePage } from "@ngriffin_uk/polychat-component-shell";
import { useParams } from "react-router";

export function meta() {
  return [{ title: "Project teammate - Polychat" }];
}

export default function ProjectTeammateHomePage() {
  const { workspaceId = "", projectId = "", teammateId = "" } = useParams();
  const teammatesPath = `/work/${workspaceId}/projects/${projectId}/teammates`;

  return (
    <TeammateHomePage
      teammateId={teammateId}
      teammatesPath={teammatesPath}
      backPath={teammatesPath}
      backLabel="Back to teammates"
      projectId={projectId}
    />
  );
}
