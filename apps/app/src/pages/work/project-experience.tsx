import { useParams } from "react-router";

import { AppRoute } from "~/components/Apps/AppRoute";
import { useWorkData } from "~/components/Work/WorkDataContext";
import { getProjectSurface } from "~/lib/capability-surfaces";

export function meta() {
  return [{ title: "Project app - Polychat" }];
}

export default function ProjectAppPage() {
  const { workspaceId = "", projectId = "", experienceId = "", "*": subpath = "" } = useParams();
  const { projectQuery } = useWorkData();

  return (
    <AppRoute
      surface={getProjectSurface(workspaceId, projectId)}
      experienceId={experienceId}
      subpath={subpath}
      project={{
        name: projectQuery.data?.name,
        capabilities: projectQuery.data?.capabilities,
        isLoading: projectQuery.isLoading,
        error: projectQuery.error,
      }}
    />
  );
}
