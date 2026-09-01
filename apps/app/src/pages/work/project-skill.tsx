import { useParams } from "react-router";

import { SkillEditorPage } from "~/components/Capabilities/SkillEditor/SkillEditorPage";

export function meta() {
  return [{ title: "Edit project skill - Polychat" }];
}

export default function ProjectSkillPage() {
  const { workspaceId = "", projectId = "", skillId = "" } = useParams();

  return (
    <SkillEditorPage
      skillId={skillId}
      projectId={projectId}
      backPath={`/work/${workspaceId}/projects/${projectId}/library`}
      backLabel="Back to project capabilities"
    />
  );
}
