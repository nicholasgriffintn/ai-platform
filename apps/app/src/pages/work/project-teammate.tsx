import { useParams } from "react-router";

import { TeammateEditorPage } from "~/components/Teammates/TeammateEditorPage";

export function meta() {
  return [{ title: "Configure a teammate - Polychat" }];
}

export default function ProjectTeammatePage() {
  const { workspaceId = "", projectId = "", teammateId = "" } = useParams();
  const projectPath = `/work/${workspaceId}/projects/${projectId}`;

  return (
    <TeammateEditorPage
      teammateId={teammateId}
      teammatesPath={`${projectPath}/teammates`}
      backPath={`${projectPath}/teammates`}
      backLabel="Back to capabilities"
      projectId={projectId}
    />
  );
}
