import { SkillEditorPage, useWorkData } from "@ngriffin_uk/polychat-component-shell";
import { useParams } from "react-router";

export function meta() {
  return [{ title: "Review a skill - Polychat" }];
}

export default function ProjectSkillPage() {
  const { workspaceId = "", projectId = "", skillId = "" } = useParams();
  const { workspaceQuery } = useWorkData();
  const canManage = workspaceQuery.data?.role === "owner" || workspaceQuery.data?.role === "admin";
  const projectPath = `/work/${workspaceId}/projects/${projectId}`;

  return (
    <SkillEditorPage
      skillId={skillId}
      projectId={projectId}
      canManage={canManage}
      backPath={`${projectPath}/plugins`}
      backLabel="Back to plugins"
    />
  );
}
