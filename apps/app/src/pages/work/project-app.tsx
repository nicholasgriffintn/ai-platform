import { AppRoute } from "@ngriffin_uk/polychat-component-shell";
import { getProjectSurface } from "@ngriffin_uk/polychat-library-react";
import { useParams } from "react-router";

import { useWorkData } from "~/components/Work/WorkDataContext";

export function meta() {
  return [{ title: "Project app - Polychat" }];
}

export default function ProjectAppPage() {
  const { workspaceId = "", projectId = "", appId = "", "*": subpath = "" } = useParams();
  const { projectQuery } = useWorkData();

  return (
    <AppRoute
      surface={getProjectSurface(workspaceId, projectId)}
      appId={appId}
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
