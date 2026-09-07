import {
  CapabilityLibrary,
  useProjectCapabilityScope,
} from "@ngriffin_uk/polychat-component-shell";

import { useWorkData } from "./WorkDataContext";

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
      title="Teammates &amp; tools"
      subtitle={`Pick what ${
        projectQuery.data?.name ?? "this project"
      } can reach for. Anything you add here is available to every member.`}
    />
  );
}
