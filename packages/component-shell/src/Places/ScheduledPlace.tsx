import { usePersonalCapabilityScope } from "../Capabilities/useCapabilityLibraryController.js";
import { ScheduledLibrary } from "../Scheduled/ScheduledLibrary.js";
import { ProjectScheduledLibrary } from "../Work/ProjectScheduledLibrary.js";
import { usePlaceScope } from "./place-scope.js";

function PersonalScheduled() {
  const scope = usePersonalCapabilityScope();

  return (
    <ScheduledLibrary
      scope={scope}
      title="Scheduled"
      subtitle="The automations you have installed, and the schedules and triggers they run on."
    />
  );
}

export function ScheduledPlace() {
  const scope = usePlaceScope();

  return scope.kind === "project" ? (
    <ProjectScheduledLibrary workspaceId={scope.workspaceId} projectId={scope.projectId} />
  ) : (
    <PersonalScheduled />
  );
}
