import { CapabilityLibrary } from "../Capabilities/CapabilityLibrary.js";
import {
  TEAMMATE_LIBRARY_KINDS,
  usePersonalCapabilityScope,
} from "../Capabilities/useCapabilityLibraryController.js";
import { ProjectCapabilityLibrary } from "../Work/ProjectCapabilityLibrary.js";
import { usePlaceScope } from "./place-scope.js";

function PersonalTeammates() {
  const scope = usePersonalCapabilityScope();

  return (
    <CapabilityLibrary
      scope={scope}
      kinds={TEAMMATE_LIBRARY_KINDS}
      title="Teammates"
      subtitle="The teammates you have hired."
    />
  );
}

export function TeammatesPlace() {
  const scope = usePlaceScope();

  return scope.kind === "project" ? (
    <ProjectCapabilityLibrary workspaceId={scope.workspaceId} projectId={scope.projectId} />
  ) : (
    <PersonalTeammates />
  );
}
