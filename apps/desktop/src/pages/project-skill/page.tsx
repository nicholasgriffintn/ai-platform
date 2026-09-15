import { SkillEditorPage, useWorkData } from "@ngriffin_uk/polychat-component-shell";
import { getProjectBasePath } from "@ngriffin_uk/polychat-library-react";
import { useParams } from "react-router";

export default function DesktopProjectSkillPage() {
  const { workspaceId = "", projectId = "", skillId = "" } = useParams();
  const { workspaceQuery } = useWorkData();
  const canManage = workspaceQuery.data?.role === "owner" || workspaceQuery.data?.role === "admin";

  return (
    <SkillEditorPage
      skillId={skillId}
      projectId={projectId}
      canManage={canManage}
      backPath={`${getProjectBasePath(workspaceId, projectId)}/plugins`}
      backLabel="Back to plugins"
    />
  );
}
