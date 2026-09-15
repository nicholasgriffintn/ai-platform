import { useProjectCapabilityScope } from "../Capabilities/useCapabilityLibraryController.js";
import { useWorkData } from "../Work/WorkDataContext.js";
import { PluginsLibrary } from "./PluginsLibrary.js";

export function ProjectPluginsPage({
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

  return <PluginsLibrary scope={scope} projectName={projectQuery.data?.name} />;
}
