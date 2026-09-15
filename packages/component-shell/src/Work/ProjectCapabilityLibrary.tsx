import { CapabilityLibrary } from "../Capabilities/CapabilityLibrary.js";
import {
  TEAMMATE_LIBRARY_KINDS,
  useProjectCapabilityScope,
} from "../Capabilities/useCapabilityLibraryController.js";
import { useWorkData } from "./WorkDataContext.js";

export function ProjectCapabilityLibrary({
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
    <CapabilityLibrary
      scope={scope}
      kinds={TEAMMATE_LIBRARY_KINDS}
      title="Teammates"
      subtitle={`The teammates ${projectQuery.data?.name ?? "this project"} can work with. Anything you add here is available to every member.`}
    />
  );
}
