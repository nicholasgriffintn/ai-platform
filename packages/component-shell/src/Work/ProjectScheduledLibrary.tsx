import { useProjectCapabilityScope } from "../Capabilities/useCapabilityLibraryController.js";
import { ScheduledLibrary } from "../Scheduled/ScheduledLibrary.js";
import { useWorkData } from "./WorkDataContext.js";

export function ProjectScheduledLibrary({
  workspaceId,
  projectId,
}: {
  workspaceId: string;
  projectId: string;
}) {
  const { projectQuery, workspaceQuery } = useWorkData();
  const scope = useProjectCapabilityScope(
    workspaceId,
    projectId,
    projectQuery.data,
    workspaceQuery.data?.role,
    projectQuery.error,
    projectQuery.isLoading,
  );

  return (
    <ScheduledLibrary
      scope={scope}
      title="Scheduled"
      subtitle={`The automations ${
        projectQuery.data?.name ?? "this project"
      } runs on a schedule or a trigger.`}
    />
  );
}
