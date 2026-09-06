import { useParams } from "react-router";

import { AppsPage } from "~/components/Apps/AppsPage";
import { useWorkData } from "~/components/Work/WorkDataContext";
import { getProjectSurface } from "~/lib/capability-surfaces";

export function meta() {
  return [{ title: "Project apps - Polychat" }];
}

export default function ProjectAppsPage() {
  const { workspaceId = "", projectId = "" } = useParams();
  const { projectQuery } = useWorkData();

  return (
    <AppsPage
      surface={getProjectSurface(workspaceId, projectId)}
      project={{
        name: projectQuery.data?.name,
        capabilities: projectQuery.data?.capabilities,
        isLoading: projectQuery.isLoading,
        error: projectQuery.error,
      }}
    />
  );
}
