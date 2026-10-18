import { useParams } from "react-router";

import { SkillEditorPage } from "../Skills/SkillEditorPage.js";
import { useWorkData } from "../Work/WorkDataContext.js";
import { getPlaceScopePaths, usePlaceScope, type PlaceScope } from "./place-scope.js";

function ProjectSkill({
  scope,
  skillId,
}: {
  scope: Extract<PlaceScope, { kind: "project" }>;
  skillId: string;
}) {
  const { workspaceQuery } = useWorkData();
  const role = workspaceQuery.data?.role;

  return (
    <SkillEditorPage
      skillId={skillId}
      projectId={scope.projectId}
      canManage={role === "owner" || role === "admin"}
      backPath={getPlaceScopePaths(scope).plugins}
      backLabel="Back to plugins"
    />
  );
}

export function SkillPlace() {
  const scope = usePlaceScope();
  const { skillId = "" } = useParams();

  if (scope.kind === "project") {
    return <ProjectSkill scope={scope} skillId={skillId} />;
  }

  return (
    <SkillEditorPage
      skillId={skillId}
      backPath={getPlaceScopePaths(scope).plugins}
      backLabel="Back to plugins"
    />
  );
}
