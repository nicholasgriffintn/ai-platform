import { getProjectSurface, PERSONAL_SURFACE } from "@ngriffin_uk/polychat-library-react";
import { useParams } from "react-router";

import { AppRoute } from "../Apps/AppRoute.js";
import { useWorkData } from "../Work/WorkDataContext.js";
import { usePlaceScope, type PlaceScope } from "./place-scope.js";

function ProjectApp({
  scope,
  appId,
  subpath,
}: {
  scope: Extract<PlaceScope, { kind: "project" }>;
  appId: string;
  subpath: string;
}) {
  const { projectQuery } = useWorkData();

  return (
    <AppRoute
      surface={getProjectSurface(scope.workspaceId, scope.projectId)}
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

export function AppPlace() {
  const scope = usePlaceScope();
  const { appId = "", "*": subpath = "" } = useParams();

  if (scope.kind === "project") {
    return <ProjectApp scope={scope} appId={appId} subpath={subpath} />;
  }

  return <AppRoute surface={PERSONAL_SURFACE} appId={appId} subpath={subpath} />;
}
